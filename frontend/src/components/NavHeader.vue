<script lang="ts" setup>
import Button from "./ui/button/Button.vue";
import { useRouter } from "vue-router";
import NavigationMenu from "./ui/navigation-menu/NavigationMenu.vue";
import NavigationMenuList from "./ui/navigation-menu/NavigationMenuList.vue";
import NavigationMenuItem from "./ui/navigation-menu/NavigationMenuItem.vue";
import NavigationMenuTrigger from "./ui/navigation-menu/NavigationMenuTrigger.vue";
import NavigationMenuLink from "./ui/navigation-menu/NavigationMenuLink.vue";
import NavigationMenuContent from "./ui/navigation-menu/NavigationMenuContent.vue";
import { Icon } from "@iconify/vue";
import { ref } from "vue";
import Popover from "./ui/popover/Popover.vue";
import PopoverTrigger from "./ui/popover/PopoverTrigger.vue";
import PopoverContent from "./ui/popover/PopoverContent.vue";
import Accordion from "./ui/accordion/Accordion.vue";
import AccordionItem from "./ui/accordion/AccordionItem.vue";
import AccordionTrigger from "./ui/accordion/AccordionTrigger.vue";
import AccordionContent from "./ui/accordion/AccordionContent.vue";
import { PopoverClose } from "reka-ui";
import Toggle from "./ui/toggle/Toggle.vue";
import { useColorMode } from "@vueuse/core";
import Label from "./ui/label/Label.vue";
import Switch from "./ui/switch/Switch.vue";
import LoginPopover from "./loginRegister/LoginPopover.vue";
import LoginDrawer from "./loginRegister/LoginDrawer.vue";
import { useUserStore } from "@/stores/userStore";
import { useAuth } from "@/composables/useAuth";
import { usePuzzleNavigation } from "@/composables/usePuzzleNavigation";
import { useGameSession } from "@/composables/useGameSession";
const router = useRouter();
const userStore = useUserStore();
const { logout } = useAuth();
const colormode = useColorMode();
const { hasInProgressPuzzle } = useGameSession()
const menuPressed = ref(false);
const { chooseNewPuzzle, resumePuzzle } = usePuzzleNavigation()
</script>

<template>
  <header class="w-full p-4 flex justify-between border-b shadow">
    <h1 class="text-3xl hover:cursor-pointer text-orange-400 font-bold">
      <a @click="router.push({ name: 'home' })">Infinite Sudoku</a>
    </h1>
    <!-- Medium and wider menu -->
    <div class="hidden md:flex md:flex-row">
      <NavigationMenu :viewport="false">
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
            <NavigationMenuTrigger>Puzzles</NavigationMenuTrigger>
            <NavigationMenuContent>
              <NavigationMenuLink v-if="hasInProgressPuzzle" as-child>
                <Button class="w-full items-start" variant="link" @click="() => resumePuzzle()">Resume</Button>
              </NavigationMenuLink>
              <NavigationMenuLink as-child>
                <Button class="w-full items-start" variant="link"
                  @click="() => chooseNewPuzzle('beginner')">Beginner</Button>
              </NavigationMenuLink>
              <NavigationMenuLink as-child>
                <Button class="w-full items-start" variant="link" @click="() =>
                  chooseNewPuzzle('easy')">Easy</Button>
              </NavigationMenuLink>
              <NavigationMenuLink as-child>
                <Button class="w-full items-start" variant="link" @click="() =>
                  chooseNewPuzzle('medium')">Medium</Button>
              </NavigationMenuLink>
              <NavigationMenuLink as-child>
                <Button class="w-full items-start" variant="link" @click="() =>
                  chooseNewPuzzle('hard')">Hard</Button>
              </NavigationMenuLink>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuLink as-child>
              <LoginPopover v-if="!userStore.isAuthenticated" />
              <Button v-else @click="logout()" variant="link" class="mr-2 ml-0">Logout</Button>
            </NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
      <Toggle :model-value="colormode === 'dark'" class="ml-2" @update:model-value="
        (val) => (val ? (colormode = 'dark') : (colormode = 'light'))
      ">
        <Icon v-if="colormode === 'dark'" icon="line-md:moon-simple" />
        <Icon v-else icon="line-md:sunny" />
      </Toggle>
    </div>
    <!-- Mobile Menu-->
    <Popover class="md:hidden" v-slot="{ open }">
      <PopoverTrigger class="md:hidden" as-child>
        <Button size="icon" @click="() => (menuPressed = true)" variant="ghost">
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
              <Button variant="link" :data-state="open ? 'open' :
                'closed'">Puzzles</Button>
              <template v-slot:icon>
                <!-- Overriding the default icon with nothing -->
                {{ "" }}
              </template>
            </AccordionTrigger>
            <AccordionContent class="flex flex-col items-end">
              <PopoverClose v-if="hasInProgressPuzzle" as-child>
                <Button @click="() => resumePuzzle()" variant="link">Resume</Button>
              </PopoverClose>
              <PopoverClose as-child>
                <Button @click="() => chooseNewPuzzle('beginner')" variant="link">Beginner</Button>
              </PopoverClose>
              <PopoverClose as-child>
                <Button @click="() => chooseNewPuzzle('easy')" variant="link">Easy</Button>
              </PopoverClose>
              <PopoverClose as-child>
                <Button @click="() => chooseNewPuzzle('medium')" variant="link">Medium</Button>
              </PopoverClose>
              <PopoverClose as-child>
                <Button @click="() => chooseNewPuzzle('hard')" variant="link">Hard</Button>
              </PopoverClose>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <LoginDrawer v-if="!userStore.isAuthenticated" />
        <Button v-else variant="link" @click="logout()">Logout</Button>
        <div class="flex py-2">
          <Label class="pr-2 font-medium">Dark Mode: </Label>
          <Switch :model-value="colormode === 'dark'" @update:model-value="
            (val) => (val ? (colormode = 'dark') : (colormode = 'light'))
          " />
        </div>
      </PopoverContent>
    </Popover>
  </header>
</template>
