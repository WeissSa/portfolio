<template>
  <div
    class="w-44 ml-[3.1rem] sm:w-[34rem] md:w-full md:mx-auto rounded-lg border hover:bg-desaturated-purple-200 bg-violet-300 border-gray-500 drop-shadow shadow p-5"
  >
    <button
      class="flex flex-col mx-auto w-44 sm:w-[34rem] md:w-[36rem]"
      @click="handleExpansion"
    >
      <div class="flex flex-col sm:flex-row justify-around">
        <p class="hidden sm:block w-10 -mt-1">
          <img v-if="isExpanded" alt="caret up" src="../assets/caret-up.svg" />
          <img v-else alt="caret down" src="../assets/caret-down.svg" />
        </p>
        <div class="sm:w-[29rem] md:w-[32rem]">
          <h2
            class="text-gray-800 text-sm sm:text-xl text-left md:text-center whitespace-pre-wrap md:pb-12"
          >
            {{ title }}
          </h2>
        </div>
        <a v-if="repo !== '/private'" :href="repo">
          <img
            alt="github logo"
            src="../assets/GitHub.png"
            class="w-6 sm:mr-10 md:ml-5 sm:flex mx-auto sm:mx-0 ml-[3.5rem]"
            @click="handleExpansion"
          />
        </a>
        <router-link v-else :to="repo">
          <img
            alt="github logo"
            src="../assets/GitHub.png"
            class="w-6 sm:mr-10 md:ml-5 sm:flex mx-auto sm:mx-0 ml-[3.5rem]"
            @click="handleExpansion"
          />
        </router-link>
      </div>
      <div
        class="flex pt-12 md:pt-0 flex-col sm:mr-10 md:mr-0 sm:flex-row-reverse md:w-[34rem] flex-wrap -mt-12"
      >
        <PostTag
          v-for="tag in tags"
          :key="`${title}-tag-${tag}`"
          :tag="tag"
          @click="handleExpansion"
        />
      </div>
    </button>
    <div v-if="isExpanded" class="flex-col mx-auto">
      <div
        class="w-36 md:w-[36rem] overflow-autotext-left text-sm md:text-base"
        v-html="description"
      />
      <img
        :alt="`Screenshot or picture of ${title}`"
        :src="`${publicPath}${thumbnail}`"
        class="mx-auto w-32 h-32 md:w-60 md:h-60 object-cover"
      />
    </div>
  </div>
</template>

<script>
import PostTag from "./PostTag.vue";
export default {
  components: { PostTag },
  props: {
    title: {
      required: true,
      type: String,
    },
    repo: {
      required: true,
      type: String,
    },
    tags: {
      required: true,
      type: Array,
    },
    description: {
      required: true,
      type: String,
    },
    thumbnail: {
      required: true,
      type: String,
    },
  },
  data() {
    return {
      isExpanded: false,
      publicPath: process.env.BASE_URL,
    };
  },
  methods: {
    handleExpansion() {
      this.isExpanded = !this.isExpanded;
    },
  },
};
</script>
