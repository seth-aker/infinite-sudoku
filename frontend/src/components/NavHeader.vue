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
import { Icon } from '@iconify/vue';
import { ref } from 'vue';
import Popover from './ui/popover/Popover.vue';
import PopoverTrigger from './ui/popover/PopoverTrigger.vue';
import PopoverContent from './ui/popover/PopoverContent.vue';
import Accordion from './ui/accordion/Accordion.vue';
import AccordionItem from './ui/accordion/AccordionItem.vue';
import AccordionTrigger from './ui/accordion/AccordionTrigger.vue';
import AccordionContent from './ui/accordion/AccordionContent.vue';
import { PopoverClose } from 'reka-ui';
const router = useRouter()
const sudokuStore = useSudokuStore();
const gameStore = useGameStore();
// const { isAuthenticated, isLoading, loginWithRedirect, logout, getAccessTokenSilently } = useAuth0();
// const loginOptions: RedirectLoginOptions<AppState> = {
//   openUrl(url) {
//     window.location.replace(url)
//   }
// }

const menuPressed = ref(false)

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
    <!-- Medium and wider menu -->
    <div class="hidden md:block">
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
    <!-- Mobile Menu-->
    <Popover class="md:hidden" v-slot="{ open }">
      <PopoverTrigger class="md:hidden" as-child>
        <Button size="icon" @click="() => menuPressed = true">
          <Icon v-if="!menuPressed" icon="line-md:menu" />
          <Icon v-else-if="open" icon="line-md:menu-to-close-alt-transition" />
          <Icon v-else icon="line-md:close-to-menu-alt-transition" />
        </Button>
      </PopoverTrigger>
      <PopoverContent class="flex flex-col items-end w-64">
        <PopoverClose as-child>
          <Button @click="() => router.push({ name: 'home' })" variant="link">Home</Button>
        </PopoverClose>
        <PopoverClose as-child>
          <Button @click="() => router.push({ name: 'about' })" variant="link">About</Button>
        </PopoverClose>
        <Accordion collapsible>
          <AccordionItem value="new-puzzle-opts">
            <AccordionTrigger class="justify-end py-2">New Puzzle</AccordionTrigger>
            <AccordionContent class="flex flex-col items-end">
              <PopoverClose as-child>
                <Button @click="() => gotoPuzzle('beginner')" variant="link">Beginner</Button>
              </PopoverClose>
              <PopoverClose as-child>
                <Button @click="() => gotoPuzzle('easy')" variant="link">Easy</Button>
              </PopoverClose>
              <PopoverClose as-child>
                <Button @click="() => gotoPuzzle('medium')" variant="link">Medium</Button>
              </PopoverClose>
              <PopoverClose as-child>
                <Button @click="() => gotoPuzzle('hard')" variant="link" disabled>Hard (Comming Soon)</Button>
              </PopoverClose>
              <PopoverClose as-child>
                <Button @click="() => gotoPuzzle('impossible')" variant="link" disabled>Impossible (Comming
                  Soon)</Button>
              </PopoverClose>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </PopoverContent>
    </Popover>
  </header>
</template>
