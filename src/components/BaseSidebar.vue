<template>
  <aside
    class="transform top-0 left-0 bg-gray-500 w-20 sm:w-80 text-gray-200 text-center fixed h-full overflow-auto ease-in-out transition-all duration-300 z-30 flex flex-col"
    :class="isOpen ? 'translate-x-0' : '-translate-x-1/2 sm:-translate-x-3/4'"
  >
    <button
      id="expand-button"
      @click="isOpen = !isOpen"
      class="text-3xl pt-2 z-50"
      :class="{
        'pr-2 mx-auto sm:mx-0 sm:ml-auto': isShowing,
        'absolute -top-1 right-2 sm:right-4': !isShowing,
      }"
      aria-label="expand/contract the sidebar"
    >
      {{ isShowing ? "←" : "→" }}
    </button>
    <div v-if="isShowing" id="sidebar-content" class="my-auto w-20 sm:w-80">
      <img
        src="../assets/Profile.png"
        class="w-20 sm:w-40 mx-auto py-7"
        alt="a photo of myself"
      />
      <h1 class="text-xl sm:text-3xl">Samuel Weiss</h1>
      <h2 class="text-sm sm:text-xl my-4">
        Computer Science Student at University of Toronto
      </h2>
      <nav
        class="flex flex-col text-center m-auto text-sm sm:text-xl space-y-5"
      >
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
          class="w-5 sm:w-20 mx-auto pt-7"
          alt="github logo"
        />
      </a>
    </div>
  </aside>
</template>

<script>
export const tabs = [
  {
    link: "/",
    name: "Home",
  },
  {
    link: "/resume",
    name: "Resume",
  },
];

export default {
  data() {
    return {
      isShowing: true,
      isOpen: true,
      tabs,
    };
  },
  watch: {
    isOpen: {
      immediate: true,
      async handler(isOpen) {
        if (!isOpen) {
          setTimeout(() => {
            this.isShowing = false;
          }, 150);
        } else {
          this.isShowing = true;
        }
      },
    },
  },
};
</script>
