<template>
  <aside
    class="transform top-0 left-0 bg-slate-800 w-20 sm:w-80 text-gray-200 text-center fixed h-full overflow-auto ease-in-out transition-all duration-300 z-30 flex flex-col"
    :class="isOpen ? 'translate-x-0' : '-translate-x-1/2 sm:-translate-x-3/4'"
  >
    <button
      id="expand-button"
      @click="isOpen = !isOpen"
      class="text-3xl pt-2 z-50 hover:text-gray-400"
      :class="{
        'pr-2 mx-auto sm:mx-0 sm:ml-auto': isShowing,
        'absolute -top-1 right-1 mx-auto sm:right-6': !isShowing,
      }"
      aria-label="expand/contract the sidebar"
    >
      {{ isShowing ? "←" : "→" }}
    </button>
    <div
      v-if="isShowing"
      id="sidebar-content"
      class="mt-5 sm:my-auto w-20 sm:w-80"
    >
      <img
        src="../assets/Profile.png"
        class="w-15 sm:w-40 mx-auto py-7"
        alt="a photo of myself"
      />
      <h1 class="text-xl sm:text-3xl">Samuel Weiss</h1>
      <h2 class="text-sm sm:text-xl my-4">
        Computer Science Student at University of Toronto
      </h2>
      <nav
        class="flex flex-col text-center m-auto text-sm sm:text-xl gap-y-2 sm:gap-y-5"
      >
        <RouterLink
          v-for="tab in tabs"
          :key="tab.name"
          :to="tab.link"
          class="hover:text-gray-400"
          :class="tab.name.split(' ')[0]"
        >
          {{ tab.name }}
        </RouterLink>
      </nav>
      <nav class="flex flex-col sm:flex-row justify-center gap-y-2 sm:gap-x-5">
        <a href="https://github.com/WeissSa">
          <img
            src="../assets/GitHub.png"
            class="w-10 sm:w-20 mx-auto pt-3 sm:pt-7"
            alt="github logo"
          />
        </a>
        <a href="https://linkedin.com/in/samuelbsweiss">
          <img
            src="../assets/Linkedin.png"
            class="w-10 sm:w-20 mx-auto pt-3 sm:pt-7"
            alt="linkedin logo"
          />
        </a>
      </nav>
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
    link: "/about-me",
    name: "About Me",
  },
];

export default {
  data() {
    return {
      isShowing: false,
      isOpen: false,
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
