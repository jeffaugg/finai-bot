import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { DateService } from '../src/services/DateService';

dotenv.config();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.error('❌ SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórios no .env');
  process.exit(1);
}

const supabase = createClient(url, key);
const dateService = new DateService();
const dryRun = process.argv.includes('--dry-run');

type CloseResult = 'success' | 'reserve_used' | 'streak_reset';

interface SnapshotRow {
  id: string;
  user_id: string;
  snapshot_date: string;
  current_streak: number;
  success_reserve: number;
  daily_limit: number;
  total_spent: number;
  had_activity: boolean;
  close_result: CloseResult;
}

interface UserRow {
  id: string;
  telegram_id: number;
  success_reserve: number;
  current_streak: number;
  max_streak: number;
  last_closed_date: string | null;
}

interface CloseState {
  reserve: number;
  streak: number;
}

function applyClose(
  state: CloseState,
  limit: number,
  total: number
): { state: CloseState; result: CloseResult } {
  if (total <= limit) {
    return {
      state: { reserve: state.reserve + (limit - total), streak: state.streak + 1 },
      result: 'success',
    };
  }
  const excesso = total - limit;
  if (state.reserve >= excesso) {
    return {
      state: { reserve: state.reserve - excesso, streak: state.streak },
      result: 'reserve_used',
    };
  }
  return { state: { reserve: 0, streak: 0 }, result: 'streak_reset' };
}

// Reconstrói o estado pré-fechamento a partir do snapshot gravado (pós-fechamento).
function invertClose(snap: SnapshotRow): CloseState {
  const limit = Number(snap.daily_limit);
  const total = Number(snap.total_spent);
  const reserve = Number(snap.success_reserve);
  const streak = Number(snap.current_streak);

  switch (snap.close_result) {
    case 'success':
      return { reserve: reserve - (limit - total), streak: streak - 1 };
    case 'reserve_used':
      return { reserve: reserve + (total - limit), streak };
    default:
      return { reserve: 0, streak: 0 };
  }
}

async function sumByType(
  userId: string,
  dateStr: string,
  type: 'EXPENSE' | 'INFLOW'
): Promise<number> {
  const { start, end } = dateService.getDayBoundsForLocalDate(dateStr);
  const { data, error } = await supabase
    .from('transactions')
    .select('amount')
    .eq('user_id', userId)
    .eq('type', type)
    .is('deleted_at', null)
    .gte('date', start.toISOString())
    .lte('date', end.toISOString());

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Array<{ amount: number | string }>).reduce(
    (acc, row) => acc + Number(row.amount),
    0
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

async function repairUser(user: UserRow, snapshots: SnapshotRow[]): Promise<void> {
  const todayStr = dateService.getCurrentLocalDateString();
  const toRepair = snapshots.filter((s) => s.snapshot_date < todayStr);
  const premature = snapshots.filter((s) => s.snapshot_date >= todayStr);

  console.log(`\n👤 Usuário ${user.telegram_id} (${snapshots.length} snapshots)`);

  let state = invertClose(snapshots[0]);
  let maxStreak = state.streak;

  for (const [index, snap] of toRepair.entries()) {
    if (index > 0) {
      state.reserve += await sumByType(user.id, snap.snapshot_date, 'INFLOW');
    }

    const totalReal = await sumByType(user.id, snap.snapshot_date, 'EXPENSE');
    const { state: nextState, result } = applyClose(state, Number(snap.daily_limit), totalReal);
    state = { reserve: round2(nextState.reserve), streak: nextState.streak };
    maxStreak = Math.max(maxStreak, state.streak);

    const changed =
      round2(Number(snap.total_spent)) !== round2(totalReal) ||
      snap.close_result !== result ||
      round2(Number(snap.success_reserve)) !== state.reserve ||
      Number(snap.current_streak) !== state.streak;

    console.log(
      `  📅 ${snap.snapshot_date}: gasto ${Number(snap.total_spent).toFixed(2)} → ${totalReal.toFixed(2)}, ` +
        `${snap.close_result} → ${result}, reserva ${Number(snap.success_reserve).toFixed(2)} → ${state.reserve.toFixed(2)}, ` +
        `streak ${snap.current_streak} → ${state.streak}${changed ? '' : ' (sem mudança)'}`
    );

    if (!dryRun && changed) {
      const { error } = await supabase
        .from('daily_snapshots')
        .update({
          total_spent: totalReal,
          had_activity: totalReal > 0,
          close_result: result,
          success_reserve: state.reserve,
          current_streak: state.streak,
        })
        .eq('id', snap.id);

      if (error) {
        throw new Error(`snapshot ${snap.id}: ${error.message}`);
      }
    }
  }

  for (const snap of premature) {
    console.log(`  🗑️  ${snap.snapshot_date}: snapshot prematuro (dia em andamento) será removido`);
    if (!dryRun) {
      const { error } = await supabase.from('daily_snapshots').delete().eq('id', snap.id);
      if (error) {
        throw new Error(`delete snapshot ${snap.id}: ${error.message}`);
      }
    }
  }

  const inflowsHoje = await sumByType(user.id, todayStr, 'INFLOW');
  const lastClosed = toRepair.length ? toRepair[toRepair.length - 1].snapshot_date : null;
  const finalUser = {
    success_reserve: round2(state.reserve + inflowsHoje),
    current_streak: state.streak,
    max_streak: Math.max(maxStreak, 0),
    last_closed_date: lastClosed,
  };

  console.log(
    `  ✅ users: reserva ${Number(user.success_reserve).toFixed(2)} → ${finalUser.success_reserve.toFixed(2)}, ` +
      `streak ${user.current_streak} → ${finalUser.current_streak}, max ${user.max_streak} → ${finalUser.max_streak}, ` +
      `last_closed → ${finalUser.last_closed_date ?? 'null'}`
  );

  if (dryRun) {
    return;
  }

  const { error: userError } = await supabase.from('users').update(finalUser).eq('id', user.id);
  if (userError) {
    throw new Error(`users ${user.id}: ${userError.message}`);
  }

  const { error: eventError } = await supabase.from('user_events').insert({
    user_id: user.id,
    type: 'snapshots_repaired',
    payload: {
      repaired_days: toRepair.map((s) => s.snapshot_date),
      deleted_days: premature.map((s) => s.snapshot_date),
      before: {
        success_reserve: Number(user.success_reserve),
        current_streak: Number(user.current_streak),
        max_streak: Number(user.max_streak),
      },
      after: finalUser,
    },
  });
  if (eventError) {
    console.warn(`  ⚠️ evento snapshots_repaired não gravado: ${eventError.message}`);
  }
}

async function main() {
  console.log(dryRun ? '🔍 Modo dry-run: nada será gravado.' : '🛠️  Reparando snapshots...');

  const { data: snapshotData, error: snapError } = await supabase
    .from('daily_snapshots')
    .select('*')
    .order('snapshot_date', { ascending: true });

  if (snapError) {
    throw new Error(snapError.message);
  }

  const snapshots = (snapshotData ?? []) as SnapshotRow[];
  if (!snapshots.length) {
    console.log('Nenhum snapshot encontrado. Nada a reparar.');
    return;
  }

  const byUser = new Map<string, SnapshotRow[]>();
  for (const snap of snapshots) {
    const list = byUser.get(snap.user_id) ?? [];
    list.push(snap);
    byUser.set(snap.user_id, list);
  }

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, telegram_id, success_reserve, current_streak, max_streak, last_closed_date')
    .in('id', [...byUser.keys()]);

  if (userError) {
    throw new Error(userError.message);
  }

  for (const user of (userData ?? []) as UserRow[]) {
    await repairUser(user, byUser.get(user.id) ?? []);
  }

  console.log(dryRun ? '\n🔍 Dry-run concluído.' : '\n🎉 Reparo concluído.');
}

main().catch((err) => {
  console.error('❌ Falha no reparo:', err);
  process.exit(1);
});
