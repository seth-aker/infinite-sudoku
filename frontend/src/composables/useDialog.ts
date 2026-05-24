import { ref } from "vue";

export interface DialogButton {
  text: string
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  onClick?: () => void | Promise<void>
  closeOnClick?: boolean
}
export interface DialogOptions {
  title: string,
  message?: string,
  buttons: DialogButton[]
} 
const isOpen = ref(false)
const dialogState = ref<DialogOptions | null>(null);
export function useDialog() {
  function showDialog(options: DialogOptions) {
    dialogState.value = options;
    isOpen.value = true;
  }
  function closeDialog() {
    isOpen.value = false;
    dialogState.value = null;
  }

  return {
    showDialog,
    closeDialog,
    isOpen,
    dialogState
  }
}
