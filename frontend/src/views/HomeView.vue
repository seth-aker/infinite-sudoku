<script setup lang="ts">
import { Button } from '@/components/ui/button';
import Card from '@/components/ui/card/Card.vue';
import CardContent from '@/components/ui/card/CardContent.vue';
import CardDescription from '@/components/ui/card/CardDescription.vue';
import CardHeader from '@/components/ui/card/CardHeader.vue';
import CardTitle from '@/components/ui/card/CardTitle.vue';
import { useRouter } from 'vue-router';
const router = useRouter()
</script>

<template>
  <main class="w-full h-full flex items-center justify-center my-20">
    <Card class="w-100">
      <CardHeader class="flex flex-col items-center justify-center">
        <CardTitle class="text-4xl">Sudoku</CardTitle>
        <CardDescription>Pick a difficulty to get started</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col items-center justify-center">
        <Button @click="router.push('/sudoku/beginner')" class="w-40 m-1">Beginner</Button>
        <Button @click="router.push('/sudoku/easy')" class="w-40 m-1">Easy</Button>
        <Button @click="router.push('/sudoku/medium')" class="w-40 m-1">Medium</Button>
        <Button disabled @click="router.push('/sudoku/hard')" class="w-40 m-1">Hard</Button>
        <Button disabled @click="router.push('/sudoku/impossible')" class="w-40 m-1">Impossible</Button>
      </CardContent>
    </Card>
  </main>
</template>
