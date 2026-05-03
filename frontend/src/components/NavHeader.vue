<script lang="ts" setup>
import Button from './ui/button/Button.vue';
import { useRoute, useRouter } from 'vue-router';
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
import Toggle from './ui/toggle/Toggle.vue';
import { useColorMode } from '@vueuse/core';
import Label from './ui/label/Label.vue';
import Switch from './ui/switch/Switch.vue';
import { useUserStore } from '@/stores/userStore';
import LoginPopover from './loginRegister/LoginPopover.vue';
import LoginDrawer from './loginRegister/LoginDrawer.vue';
import { PUZZLE_DIFFICULTY_ROUTES } from '@/router';
const router = useRouter()
const route = useRoute()
const sudokuStore = useSudokuStore();
const userStore = useUserStore();
const gameStore = useGameStore();
const colormode = useColorMode()


const menuPressed = ref(false)

const gotoPuzzle = async (difficulty: Difficulty['rating']) => {
  sudokuStore.$reset();
  sudokuStore.deleteGameStateLocal()
  gameStore.elapsedSeconds = 0;
  gameStore.clearElapsedSecondsLocal()
  if (route.params.difficulty && PUZZLE_DIFFICULTY_ROUTES.includes(route.params.difficulty as string)) {
    await sudokuStore.getNewPuzzle({ difficulty: { rating: difficulty } })
  }
  router.push({ name: 'sudoku', params: { difficulty } })
}
</script>

<template>
  <header class="w-full p-4 flex justify-between border-b shadow ">
    <h1 class="text-3xl hover:cursor-pointer text-orange-400 font-bold">
      <a @click="router.push({ name: 'home' })">Sudoku</a>
    </h1>
    <!-- Medium and wider menu -->
    <div class="hidden md:flex md:flex-row">
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuLink as-child>
              <Button class="mx-2" variant="ghost" @click="router.push({ name: 'home' })">Home</Button>
            </NavigationMenuLink>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuLink as-child>
              <Button class="mx-2" variant="ghost" @click="router.push({ name: 'about' })">About</Button>
            </NavigationMenuLink>
          </NavigationMenuItem>
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
              <LoginPopover v-if="!userStore.isAuthenticated" />
              <Button v-else @click="userStore.logout()" variant="link" class="mr-2 ml-0">Logout</Button>
            </NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
      <Toggle :model-value="colormode === 'dark'" class="ml-2"
        @update:model-value="(val) => val ? colormode = 'dark' : colormode = 'light'">
        <Icon v-if="colormode === 'dark'" icon="line-md:moon-simple" />
        <Icon v-else icon="line-md:sunny" />
      </Toggle>
    </div>
    <!-- Mobile Menu-->
    <Popover class="md:hidden" v-slot="{ open }">
      <PopoverTrigger class="md:hidden" as-child>
        <Button size="icon" @click="() => menuPressed = true" variant="ghost">
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
          <AccordionItem value="new-puzzle-opts" v-slot="{ open }">
            <AccordionTrigger class="py-0 justify-end data-[state=open]:bg-sidebar-accent">
              <Button variant="link" :data-state="open ? 'open' : 'closed'">New Puzzle</Button>
              <template v-slot:icon>
                <!-- Overriding the default icon with nothing -->
                {{ '' }}
              </template>
            </AccordionTrigger>
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
        <LoginDrawer v-if="!userStore.isAuthenticated" />
        <Button v-else variant="link" @click="userStore.logout()">Logout</Button>
        <div class="flex py-2">
          <Label class="pr-2 font-medium">Dark Mode: </Label>
          <Switch :model-value="colormode === 'dark'"
            @update:model-value="(val) => val ? colormode = 'dark' : colormode = 'light'" />
        </div>
      </PopoverContent>
    </Popover>
  </header>
</template>
