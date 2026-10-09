<script setup lang="ts">
import Popover from "./ui/popover/Popover.vue";
import PopoverContent from "./ui/popover/PopoverContent.vue";
import PopoverTrigger from "./ui/popover/PopoverTrigger.vue";
import { Icon } from "@iconify/vue";
import { Button } from "./ui/button";
</script>

<template>
  <Popover>
    <PopoverTrigger>
      <Button variant="ghost">
        <Icon icon="line-md:question-circle" />
      </Button>
    </PopoverTrigger>
    <PopoverContent>
      <div>
        <h3 class="font-bold underline">Controls</h3>
        <div>
          <span class="font-bold text-xs">1-9: </span
          ><span class="text-xs">Place number</span>
        </div>
        <div>
          <span class="font-bold text-xs">Arrow Keys: </span
          ><span class="text-xs">Navigate puzzle</span>
        </div>
        <div>
          <span class="font-bold text-xs">P: </span
          ><span class="text-xs">Toggle pencil mode.</span>
        </div>
        <div>
          <span class="font-bold text-xs">Backspace or Delete: </span
          ><span class="text-xs">Clear cell.</span>
        </div>
        <div>
          <span class="font-bold text-xs">Ctrl+Z: </span
          ><span class="text-xs">Undo action</span>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
