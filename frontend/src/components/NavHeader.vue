<script lang="ts" setup>
// import { useAuth0, type AppState, type RedirectLoginOptions } from '@auth0/auth0-vue';
import Button from './ui/button/Button.vue';
import { useRouter } from 'vue-router';
import NavigationMenu from './ui/navigation-menu/NavigationMenu.vue';
import NavigationMenuList from './ui/navigation-menu/NavigationMenuList.vue';
import NavigationMenuItem from './ui/navigation-menu/NavigationMenuItem.vue';
import NavigationMenuTrigger from './ui/navigation-menu/NavigationMenuTrigger.vue';
import NavigationMenuLink from './ui/navigation-menu/NavigationMenuLink.vue';
import NavigationMenuContent from './ui/navigation-menu/NavigationMenuContent.vue';
import { useSudokuStore } from '@/stores/sudokuStore';
import type { Difficulty } from '@/stores/models/difficulty';
import { useGameStore } from '@/stores/gameStore';
const router = useRouter()
const sudokuStore = useSudokuStore();
const gameStore = useGameStore();
// const { isAuthenticated, isLoading, loginWithRedirect, logout, getAccessTokenSilently } = useAuth0();
// const loginOptions: RedirectLoginOptions<AppState> = {
//   openUrl(url) {
//     window.location.replace(url)
//   }
// }

const gotoPuzzle = async (difficulty: Difficulty) => {
  sudokuStore.$reset();
  sudokuStore.deleteGameStateLocal()
  gameStore.clearElapsedSecondsLocal()
  if (router.currentRoute.value.name !== difficulty) {
    router.push(`/sudoku/${difficulty}`)
  } else {
    await sudokuStore.getNewPuzzle({ difficulty })
    gameStore.elapsedSeconds = 0;
  }
}
</script>

<template>
  <header class="w-full p-4 flex justify-between border-b shadow ">
    <h1 class="text-3xl hover:cursor-pointer text-orange-400 font-bold">
      <a @click="router.push({ name: 'home' })">Sudoku</a>
    </h1>
    <div>
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger>New Puzzle</NavigationMenuTrigger>
            <NavigationMenuContent>
              <NavigationMenuLink as-child>
                <Button class="w-full items-start" variant="link"
                  @click="() => gotoPuzzle('beginner')">Beginner</Button>
              </NavigationMenuLink>
              <NavigationMenuLink as-child>
                <Button class="w-full items-start" variant="link" @click="() => gotoPuzzle('easy')">Easy</Button>
              </NavigationMenuLink>
              <NavigationMenuLink as-child>
                <Button class="w-full items-start" variant="link" @click="() => gotoPuzzle('medium')">Medium</Button>
              </NavigationMenuLink>
              <NavigationMenuLink as-child>
                <Button disabled class="w-full items-start" variant="link" @click="() => gotoPuzzle('hard')">Hard
                  (Comming Soon!)</Button>
              </NavigationMenuLink>
              <NavigationMenuLink as-child>
                <Button class="w-full items-start" variant="link" disabled
                  @click="() => gotoPuzzle('impossible')">Impossible (Comming Soon)</Button>
              </NavigationMenuLink>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuLink as-child>
              <Button class="mx-2" variant="ghost" @click="router.push({ name: 'about' })">About</Button>
            </NavigationMenuLink>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuLink as-child>
              <Button class="mx-2" variant="ghost" @click="router.push({ name: 'home' })">Home</Button>
            </NavigationMenuLink>
          </NavigationMenuItem>
          <!-- <NavigationMenuItem>
            <NavigationMenuLink as-child>
              <Button v-if="!isAuthenticated" :disabled="isLoading" @click="loginWithRedirect(loginOptions)"
                class="hover:bg-orange-400">Login</Button>
              <Button v-else @click="logout()">Logout</Button>
            </NavigationMenuLink>
          </NavigationMenuItem> -->
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  </header>
</template>
