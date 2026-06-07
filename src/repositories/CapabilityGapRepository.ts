import { supabase } from '../config/clients';

export class CapabilityGapRepository {
  async record(
    userId: string,
    gap: { inputText: string; intent: string; reason: string; suggestion: string }
  ): Promise<void> {
    try {
      const { error } = await supabase.from('capability_gaps').insert({
        user_id: userId,
        input_text: gap.inputText,
        intent: gap.intent,
        reason: gap.reason,
        suggestion: gap.suggestion,
      });

      if (error) {
        console.error('[CapabilityGapRepository] falha ao registrar lacuna:', error.message);
      }
    } catch (err) {
      console.error('[CapabilityGapRepository] erro inesperado ao registrar lacuna:', err);
    }
  }
}
