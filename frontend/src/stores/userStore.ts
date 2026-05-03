import * as userService from '@/services/userService'
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { useRouter } from 'vue-router';
import { useSudokuStore } from './sudokuStore';

export interface IUserDto {
  id: string,
  displayName?: string,
  username: string,
  imageUrl?: string,
  currentPuzzleId?: string,
  role: string
}
export const useUserStore = defineStore('userStore', () => {
  const sudokuStore = useSudokuStore()
  // state
  const id = ref<string | undefined>(undefined);
  const storeDisplayName = ref<string | undefined>();
  const storeUsername = ref<string | undefined>();
  const image = ref<string | undefined>();
  const role = ref<string | undefined>();
  const userLoading = ref<boolean>(false);
  const currentPuzzleId = ref<string |undefined>(undefined)

  const error = ref<string | undefined>(undefined);

  const isAuthenticated = computed(() => !!id.value)

  const router = useRouter()

  const login = async (username: string, password: string) => {
    error.value = undefined;
    userLoading.value = true;
    const res = await userService.login(username, password);
    if(!res.success || !res.body) {
      error.value = res.message
    } else {
      id.value = res.body.id,
      storeDisplayName.value = res.body.displayName
      storeUsername.value = res.body.username
      role.value = res.body.role
      image.value = res.body.imageUrl
      currentPuzzleId.value = res.body.currentPuzzleId
      // This will overide the currentPuzzleId to a new value in the backend
      if(sudokuStore.puzzleId) {
        await sudokuStore.saveGameState()
        currentPuzzleId.value = sudokuStore.puzzleId
      }
    }
    userLoading.value = false
  }
  const logout = async () => {
    userLoading.value = true
    const res = await userService.logout()
    if(!res.success) {
      error.value = `An error occured logging out, please try again. ${res.message}`
    }
    $reset()
    router.push({name: 'home'})
  }

  const register = async (username: string, password: string, displayName?: string) => {
    userLoading.value = true;
    const res = await userService.register(username, password, displayName);
    if(!res.success || !res.body) {
      error.value = `An error occured attempting to register, please try again. ${res.message}`
    } else {
      id.value = res.body.id
      storeUsername.value = username
      storeDisplayName.value = displayName
      role.value = res.body.role
      if(sudokuStore.puzzleId) {
        await sudokuStore.saveGameState()
      }
    }
    userLoading.value = false
    
  }
  const getSelf = async () => {
    userLoading.value = true;
    const res = await userService.checkSession();
    const user = res.body
    if(res.success && user) {
      id.value = user.id
      storeDisplayName.value = user.displayName,
      storeUsername.value = user.username,
      role.value = user.role,
      image.value = user.imageUrl
      currentPuzzleId.value = user.currentPuzzleId
    }
    userLoading.value = false;
  }  

  const $reset = () => {
    id.value = undefined,
    storeDisplayName.value = undefined,
    storeUsername.value = undefined,
    image.value = undefined,
    role.value = undefined,
    userLoading.value = false,
    error.value = undefined
  }
  
  return { 
    id,
    displayName: storeDisplayName, 
    username: storeUsername, 
    image, 
    userLoading, 
    isAuthenticated, 
    error, 
    currentPuzzleId, 
    login, 
    logout, 
    register, 
    getSelf, 
    $reset}

})
