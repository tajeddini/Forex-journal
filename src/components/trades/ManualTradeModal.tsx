import { Modal } from '../ui/Modal';
import { ManualTradeForm } from './ManualTradeForm';
import type { Trade } from '../../types/database';

interface ManualTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTradeCreated?: (trade: Trade, shouldOpenJournal: boolean) => void;
  defaultAccountId?: string;
}

export function ManualTradeModal({
  isOpen,
  onClose,
  onTradeCreated,
  defaultAccountId,
}: ManualTradeModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="ثبت معامله دستی جدید"
      size="xl"
    >
      <ManualTradeForm
        defaultAccountId={defaultAccountId}
        onCancel={onClose}
        onSuccess={(trade, shouldOpenJournal) => {
          if (onTradeCreated) {
            onTradeCreated(trade, shouldOpenJournal);
          }
          onClose();
        }}
      />
    </Modal>
  );
}
