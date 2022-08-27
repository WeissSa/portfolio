<template>
  <div
    class="w-44 ml-20 sm:w-full sm:mx-auto rounded-lg border border-gray-500 drop-shadow shadow p-5"
  >
    <button
      class="flex flex-col mx-auto w-44 md:w-[36rem]"
      @click="handleExpansion"
    >
      <div class="flex flex-row justify-between">
        <p
          class="text-5xl hidden sm:block"
          :class="isExpanded ? 'mt-4' : 'mb-12'"
        >
          {{ isExpanded ? "⌃" : "⌄" }}
        </p>
        <h2 class="text-gray-800 text-sm sm:text-xl text-left sm:text-center">
          {{ title }}
        </h2>
        <a v-if="repo !== '/private'" :href="repo">
          <img
            alt="github logo"
            src="../assets/GitHub.png"
            class="w-6 ml-5 hidden sm:block"
            @click="handleExpansion"
          />
        </a>
        <router-link v-else :to="repo">
          <img
            alt="github logo"
            src="../assets/GitHub.png"
            class="w-6 ml-5 hidden sm:block"
            @click="handleExpansion"
          />
        </router-link>
      </div>
      <div
        class="flex pt-12 sm:pt-0 flex-col sm:flex-row-reverse sm:w-[34rem] flex-wrap"
        :class="isExpanded ? '-mt-12 sm:-mt-1 pb-2' : '-mt-12'"
      >
        <PostTag
          v-for="tag in tags"
          :key="`${title}-tag-${tag}`"
          :tag="tag"
          @click="handleExpansion"
        />
      </div>
    </button>
    <div v-if="isExpanded" class="tw-flex-col mx-auto">
      <div
        class="w-36 md:w-[36rem] overflow-autotext-left text-sm sm:text-base"
        v-html="description"
      />
      <img
        :alt="`Screenshot or picture of ${title}`"
        :src="`${publicPath}${thumbnail}`"
        class="mx-auto w-32 h-32 sm:w-60 sm:h-60 object-cover"
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
