import { useGameStore } from "@/stores/gameStore";
import { useUserStore } from "@/stores/userStore";
import * as userService from "@/services/userService";
import { useGameSession } from "./useGameSession";
import { useDialog } from "./useDialog";
import { useGameClock } from "./useGameClock";
import { toast } from "vue-sonner";
export function useAuth() {
  const userStore = useUserStore();
  const gameStore = useGameStore();
  const clock = useGameClock();
  const { showDialog } = useDialog();
  const { resumeSavedPuzzle, saveToServer } = useGameSession();

  async function login(email: string, password: string) {
    userStore.loading = true;
    try {
      const result = await userService.login(
        email,
        password,
      );
      if (!result.success) {
        toast.error(result.error ?? "Invalid email or password!");
        userStore.loading = false;
        return;
      }
      const user = result.body?.user;
      if (!user) {
        toast.error("Invalid email or password")
        userStore.loading = false;
        return;
      }
      userStore.set(user);
      if (gameStore.puzzleId) {
        // gamestore puzzle id !== current puzzleId
        if (
          userStore.currentPuzzleId &&
          userStore.currentPuzzleId !== gameStore.puzzleId
        ) {
          clock.pause();
          showDialog({
            title: "Resume or Overwrite?",
            message:
              "You have an unfinished puzzle already saved. Would you like to overwrite it with your current puzzle?",
            buttons: [
              {
                text: "Overwrite with current",
                onClick: async () => {
                  await saveToServer();
                },
                closeOnClick: true,
              },
              {
                text: "Resume unfinished",
                onClick: async () => {
                  await resumeSavedPuzzle(userStore.currentPuzzleId!);
                },
                closeOnClick: true,
              },
            ],
          });
          clock.start();
          // gamestore puzzle id === current puzzle id OR
          // current puzzle id is undefined
        } else {
          await saveToServer();
        }
        // !gamestore.puzzle
      } else {
        if (userStore.currentPuzzleId) {
          await resumeSavedPuzzle(userStore.currentPuzzleId);
        }
      }
      userStore.loading = false;
    } catch (err) {
      userStore.loading = false;
      toast.error("Oops! An error occured!", {
        description:
          err && typeof err === "string" ? err : (err as Error).message,
      });
    }
  }

  async function logout() {
    userStore.loading = true;
    try {
      const res = await userService.logout();
      if (!res.success) {
        toast.error("Oops! An error occured!", {
          description: res.error ?? "The logout call to the server failed.",
        });
      }
      userStore.$reset();
    } catch (err) {
      toast.error("Oops! An error occured!", {
        description:
          err && typeof err === "string" ? err : (err as Error).message,
      });
    }
    userStore.loading = false;
  }

  async function register(
    email: string,
    password: string,
    username: string,
    tosAcknowledged: boolean,
  ) {
    userStore.$reset();
    userStore.loading = true;
    try {
      const res = await userService.register(email, password, username, tosAcknowledged);
      if (!res.success) {
        toast.error("Oops! An error occured", {
          description: `Failed to register: ${res.error ?? "Didn't recieve user info from server"}`,
        });
        userStore.loading = false;
        return;
      }
      // Duplicate code bloc because of typescript strict typeing requirements
      const user = res.body?.user;
      if (!user) {
        toast.error("Oops! An error occured", {
          description: `Failed to register: Didn't recieve user info from server`
        })
        userStore.loading = false;
        return;
      }
      userStore.set(user);
      if (gameStore.puzzleId) {
        await saveToServer();
      }
      toast.success(
        `Welcome ${user.username}! Time to play!`,
      );
    } catch (err) {
      toast.error("Oops! An error occured", {
        description: `Failed to register: ${err && typeof err === "string" ? err : (err as Error).message}`,
      });
    }
    userStore.loading = false;
  }
  async function getSession() {
    const res = await userService.getSession();
    if (res.success) {
      const user = res.body?.user;
      if (user) {
        userStore.set(user);
      }
    }
  }
  return {
    login,
    logout,
    register,
    getSession,
  };
}
