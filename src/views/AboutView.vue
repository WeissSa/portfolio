<template>
  <div class="text-center mx-auto flex flex-col">
    <BaseHeader text="About Me" />
    <AboutMe />
  </div>
</template>

<script>
import BaseHeader from "@/components/BaseHeader.vue";
import AboutMe from "@/components/AboutMe.vue";

export default {
  components: { BaseHeader, AboutMe },
};
</script>
