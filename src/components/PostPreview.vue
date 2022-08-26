<template>
  <div
    class="w-full mx-auto rounded border border-gray-400 drop-shadow shadow p-5"
  >
    <button class="flex flex-col mx-auto w-[36rem]" @click="handleExpansion">
      <div class="flex flex-row justify-between">
        <p class="text-5xl" :class="isExpanded ? 'mt-4' : 'mb-12'">
          {{ isExpanded ? "⌃" : "⌄" }}
        </p>
        <h2 class="text-gray-700 text-xl text-center">{{ title }}</h2>
        <a :href="repo">
          <img
            alt="github logo"
            src="../assets/GitHub.png"
            class="w-6 ml-5"
            @click="handleExpansion"
          />
        </a>
      </div>
      <div
        class="flex flex-row-reverse"
        :class="isExpanded ? '-mt-1 pb-2' : '-mt-12'"
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
      <p class="w-[36rem] overflow-auto text-left text-base">
        {{ description }}
      </p>
      <img
        :alt="`Screenshot or picture of ${title}`"
        :src="`${publicPath}${thumbnail}`"
        class="mx-auto w-60 h-60 object-cover"
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
