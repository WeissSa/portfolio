<template>
  <div class="flex flex-col mx-auto h-screen bg-zinc-700">
    <BaseHeader text="My Experience/Projects" />
    <PostList class="py-5" />
  </div>
</template>

<script>
import BaseHeader from "@/components/BaseHeader.vue";
import PostList from "@/components/PostList.vue";

export default {
  components: { BaseHeader, PostList },
};
</script>
