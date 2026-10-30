import { toast } from 'sonner';

export function avisarAdmin(message, type = 'success') {
  if (type === 'error') toast.error(message);
  else if (type === 'warning') toast.warning(message);
  else toast.success(message);
}
