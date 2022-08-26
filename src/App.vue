<template>
  <div class="flex flex-row bg-purple-400 text-black">
    <BaseSidebar />
    <router-view />
  </div>
</template>

<script>
import BaseSidebar from "./components/BaseSidebar.vue";

export default {
  components: {
    BaseSidebar,
  },
};
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
