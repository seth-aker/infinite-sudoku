import { defineStore } from "pinia";
import { computed, ref } from "vue";

export interface UserDto {
  id: string;
  username?: string;
  email: string;
  imageUrl?: string;
  currentPuzzleId?: string;
  role: "user" | "admin";
}
export const useUserStore = defineStore("userStore", () => {
  const id = ref<string | undefined>(undefined);
  const username = ref<string | undefined>(undefined);
  const email = ref<string | undefined>(undefined);
  const imageUrl = ref<string | undefined>(undefined);
  const role = ref<string | undefined>(undefined);
  const currentPuzzleId = ref<string | undefined>(undefined);
  const loading = ref(false);

  const isAuthenticated = computed(() => !!id.value);

  function set(user: UserDto) {
    id.value = user.id;
    username.value = user.username;
    email.value = user.email;
    imageUrl.value = user.imageUrl;
    role.value = user.role;
    currentPuzzleId.value = user.currentPuzzleId;
  }
  function $reset() {
    id.value = undefined;
    username.value = undefined;
    email.value = undefined;
    imageUrl.value = undefined;
    role.value = undefined;
    currentPuzzleId.value = undefined;
    loading.value = false;
  }

  return {
    id,
    username,
    email,
    imageUrl,
    role,
    currentPuzzleId,
    loading,
    isAuthenticated,
    set,
    $reset,
  };
});
