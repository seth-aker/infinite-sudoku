import { useGameStore } from "@/stores/gameStore";
import { useUserStore } from "@/stores/userStore";
import * as userService from "@/services/userService";
import { useGameSession } from "./useGameSession";
import { useDialog } from "./useDialog";
import { useGameClock } from "./useGameClock";
import { toast } from "vue-sonner";
import { useRouter } from "vue-router";
import { usePuzzleNavigation } from "./usePuzzleNavigation";
export function useAuth() {
  const userStore = useUserStore();
  const gameStore = useGameStore();
  const clock = useGameClock();
  const router = useRouter()
  const { showDialog } = useDialog();
  const { saveToServer } = useGameSession();
  const { resumePuzzle } = usePuzzleNavigation()
  // err can be undefined: failed service results often carry no message.
  function showError(err: unknown) {
    const description =
      typeof err === "string" && err ? err
        : err instanceof Error ? err.message
          : "Something went wrong. Please try again.";
    toast.error("Oops! An error occured!", { description });
  }

  async function login(email: string, password: string) {
    userStore.loading = true;
    try {
      const result = await userService.login(
        email,
        password,
      );
      if (!result.success) {
        if (result.error && result.error.includes("Email not verified")) {
          toast.error("Email not verified!", {
            important: true,
            action: {
              label: "Resend verification email?",
              onClick: () => router.push({ name: "request-email-verification" }),
            },
            duration: Infinity
          });
        } else {
          toast.error(result.error ?? "Invalid email or password")
        }
        userStore.loading = false;
        return false;
      }
      const user = result.body?.user;
      if (!user) {
        toast.error("Invalid email or password")
        userStore.loading = false;
        return false;
      }
      userStore.set(user);
      if (gameStore.puzzleId) {
        // gamestore puzzle id !== current puzzleId
        if (
          userStore.currentPuzzleId &&
          userStore.currentPuzzleId !== gameStore.puzzleId
        ) {
          clock.halt();
          showDialog({
            title: "Resume or Overwrite?",
            message:
              "You have an unfinished puzzle already saved. Would you like to overwrite it with your current puzzle?",
            buttons: [
              {
                text: "Overwrite with current",
                onClick: async () => {
                  try {
                    const result = await saveToServer();
                    if (!result.success) {
                      showError(result.error);
                    }
                  } catch (err) {
                    showError(err);
                  } finally {
                    clock.start();
                  }
                },
                closeOnClick: true,
              },
              {
                text: "Resume unfinished",
                onClick: async () => {
                  await resumePuzzle();
                  clock.start();
                },
                closeOnClick: true,
              },
            ],
          });
          // gamestore puzzle id === current puzzle id OR
          // current puzzle id is undefined
        } else {
          const result = await saveToServer();
          if (!result.success) {
            showError(result.error);
          }
        }
        // !gamestore.puzzle
      } else {
        if (userStore.currentPuzzleId) {
          await resumePuzzle();
        }
      }
      userStore.loading = false;
      return true;
    } catch (err) {
      userStore.loading = false;
      toast.error("Oops! An error occured!", {
        description:
          err && typeof err === "string" ? err : (err as Error).message,
      });
      return false;
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
  ): Promise<boolean> {
    userStore.$reset();
    userStore.loading = true;
    try {
      const res = await userService.register(email, password, username, tosAcknowledged);
      if (!res.success) {
        toast.error("Oops! An error occured", {
          description: `Failed to register: ${res.error ?? "internal server error"}`,
        });
        userStore.loading = false;
        return false;
      }
      // Duplicate code bloc because of typescript strict typeing requirements
      const user = res.body?.user;
      if (!user) {
        toast.error("Oops! An error occured", {
          description: `Failed to register: Didn't recieve user info from server`
        })
        userStore.loading = false;
        return false;
      }
      userStore.set(user);
      if (gameStore.puzzleId) {
        const result = await saveToServer();
        if (!result.success) {
          showError(result.error);
        }
      }
      toast.success(
        `Welcome ${user.username}! Time to play!`,
      );
      userStore.loading = false;
      return true;
    } catch (err) {
      toast.error("Oops! An error occured", {
        description: `Failed to register: ${err && typeof err === "string" ? err : (err as Error).message}`,
      });
      userStore.loading = false;
      return false;
    }
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
  async function requestPasswordReset(email: string) {
    const res = await userService.requestPasswordReset(email);
    if (!res.success) {
      toast.error("Oops! An error occured", {
        description: `Failed to send reset request: ${res.error ?? 'internal server error'}`,
      })
      return false;
    }
    return true;
  }
  async function resetPassword(token: string, newPassword: string) {
    userStore.loading = true;
    try {
      const res = await userService.resetPassword(token, newPassword);
      if (!res.success) {
        toast.error("Oops! An error occured", {
          description: `Failed to reset password: ${res.error ?? 'internal server error'}`
        })
        userStore.loading = false;
        return false
      }
      if (userStore.isAuthenticated) {
        userStore.$reset();
      }
      userStore.loading = false;
      return true;
    } catch (err) {
      toast.error("Oops! An error occured", {
        description: `Failed to reset password: ${err && typeof err === "string" ? err : (err as Error).message}`,
      });
      return false;
    } finally {
      userStore.loading = false;
    }
  }

  async function requestEmailVerification(email: string) {
    const res = await userService.requestEmailVerification(email);
    if (!res.success) {
      toast.error(res.error ?? "An error occured")
    } else {
      toast.success("Verification email sent!")
    }
  }

  return {
    login,
    logout,
    register,
    resetPassword,
    requestPasswordReset,
    requestEmailVerification,
    getSession,
  };
}
