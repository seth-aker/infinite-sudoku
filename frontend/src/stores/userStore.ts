import { defineStore } from "pinia";
import { computed, ref } from "vue";

export interface UserDto {
  id: string,
  displayName?: string,
  username: string,
  imageUrl?: string,
  currentPuzzleId?: string,
  role: string
}
export const useUserStore = defineStore('userStore', () => {
  const id = ref<string | undefined>(undefined)
  const displayName = ref<string | undefined>(undefined)
  const username = ref<string | undefined>(undefined)
  const imageUrl = ref<string | undefined>(undefined)
  const role = ref<string | undefined>(undefined)
  const currentPuzzleId = ref<string | undefined>(undefined)
  const loading = ref(false)
  
  const isAuthenticated = computed(() => !!id.value)

  function set(user: UserDto) {
    id.value = user.id
    displayName.value = user.displayName
    username.value = user.username
    imageUrl.value = user.imageUrl
    role.value = user.role
    currentPuzzleId.value = user.currentPuzzleId
  }
  function $reset() {
    id.value = undefined
    displayName.value = undefined
    username.value = undefined
    imageUrl.value = undefined
    role.value = undefined
    currentPuzzleId.value = undefined
    loading.value = false
  }

  return {
    id,
    displayName,
    username,
    imageUrl,
    role,
    currentPuzzleId,
    loading,
    isAuthenticated,
    set,
    $reset
  }
})
