<template>
  <div
    class="h-screen bg-gray-700 align-middle text-gray-200 flex flex-col text-center"
  >
    <button
      id="expand-button"
      @click="isShowing = !isShowing"
      class="ml-auto text-3xl pt-2"
      :class="{ 'pr-2': isShowing, 'px-4': !isShowing }"
      aria-label="expand/contract the sidebar"
    >
      {{ isShowing ? "←" : "→" }}
    </button>
    <div v-if="isShowing" id="sidebar-content" class="my-auto w-80">
      <img
        src="../assets/Profile.png"
        class="w-40 mx-auto py-7"
        alt="a photo of myself"
      />
      <h1 class="text-3xl">Samuel Weiss</h1>
      <h2 class="text-xl my-4">
        Computer Science Student at University of Toronto
      </h2>
      <nav class="flex flex-col text-center m-auto text-xl space-y-5">
        <router-link
          v-for="tab in tabs"
          :key="tab.name"
          :to="tab.link"
          :class="tab.name"
        >
          {{ tab.name }}
        </router-link>
      </nav>
      <a href="https://github.com/WeissSa">
        <img
          src="../assets/GitHub.png"
          class="w-20 mx-auto pt-7"
          alt="github logo"
        />
      </a>
    </div>
  </div>
</template>

<script>
export const tabs = [
  {
    link: "/",
    name: "home",
  },
  {
    link: "/resume",
    name: "resume",
  },
];

export default {
  data() {
    return {
      isShowing: true,
      tabs,
    };
  },
};
</script>
