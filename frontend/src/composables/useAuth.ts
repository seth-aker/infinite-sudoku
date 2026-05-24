import { useGameStore } from "@/stores/gameStore";
import { useUserStore } from "@/stores/userStore";
import * as userService from '@/services/userService'
import { useGameSession } from "./useGameSession";
import { useDialog } from "./useDialog";
import { useGameClock } from "./useGameClock";
import { toast } from "vue-sonner";
export function useAuth() {
  const userStore = useUserStore()
  const gameStore = useGameStore()
  const clock = useGameClock()
  const { showDialog } = useDialog()
  const { resumeSavedPuzzle, saveToServer } = useGameSession()
  
  async function login(username: string, password: string) {
    userStore.loading = true;
    try {
      const {success, body, error} = await userService.login(username, password)
      if(!success || !body) {
        toast.error(error ?? "Invalid username or password!")
        userStore.loading = false;
        return;
      }
      userStore.id = body.id,
      userStore.username = body.username,
      userStore.displayName = body.displayName,
      userStore.currentPuzzleId = body.currentPuzzleId
      userStore.imageUrl = body.imageUrl
      userStore.role = body.role

      if(gameStore.puzzleId) {
        // gamestore puzzle id !== current puzzleId
        if(userStore.currentPuzzleId && userStore.currentPuzzleId !== gameStore.puzzleId) {
          clock.pause()
          showDialog({
            title: 'Resume or Overwrite?',
            message: 'You have an unfinished puzzle already saved. Would you like to overwrite it with your current puzzle?',
            buttons: [
              {
                text: 'Overwrite with current',
                onClick: async () => {
                  await saveToServer()
                },
                closeOnClick: true
              },
              {
                text: 'Resume unfinished',
                onClick: async () => {
                  await resumeSavedPuzzle(userStore.currentPuzzleId!)
                },
                closeOnClick: true
              }
            ]
          })
          clock.start()
          // gamestore puzzle id === current puzzle id OR 
          // current puzzle id is undefined
        } else {
          await saveToServer()
        }
      // !gamestore.puzzle 
      } else {
        if(userStore.currentPuzzleId) {
          await resumeSavedPuzzle(userStore.currentPuzzleId)
        }
      }  
      userStore.loading = false;    
    } catch (err) {
      userStore.loading = false;
      toast.error("Oops! An error occured!", {
        description: err && typeof err === 'string' ? err : (err as Error).message
      })
    } 
  }

  async function logout() {
    userStore.loading = true;
    try {
      const res = await userService.logout();
      if(!res.success) {
        toast.error("Oops! An error occured!", {
          description: res.error ?? "The logout call to the server failed."
        })
      }
      userStore.$reset()
    } catch (err) {
      toast.error("Oops! An error occured!", {
        description: err && typeof err === 'string' ? err : (err as Error).message
      })
    }
    userStore.loading = false;
  }

  async function register(username: string, password: string, displayName?: string) {
    userStore.$reset()
    userStore.loading = true
    try {
      const res = await userService.register(username, password, displayName);
      if(!res.success || !res.body) {
        toast.error("Oops! An error occured", {
          description: `Failed to register: ${res.error ?? "Didn't recieve user info from server"}`
        })
        userStore.loading = false;
        return;
      }
      userStore.set(res.body)
      if(gameStore.puzzleId) {
        await saveToServer()
      }
      toast.success(`Welcome ${!res.body.displayName ? res.body.username : res.body.displayName}! Time to play!`)
    } catch (err) {
      toast.error("Oops! An error occured", {
        description: `Failed to register: ${err && typeof err === 'string' ? err : (err as Error).message}`
      })
    }
    userStore.loading = false;
  }
  async function getSession() {
    const res = await userService.getSession()
    if(res.success && res.body) {
      userStore.set(res.body)
    }
  }
  return {
    login,
    logout,
    register,
    getSession
  }
}
