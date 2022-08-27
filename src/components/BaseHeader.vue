<template>
  <h1
    class="text-lg sm:text-5xl text-gray-200 pt-5 pb-2 text-center w-screen bg-purple-800"
  >
    {{ text }}:
  </h1>
</template>

<script>
export default {
  props: {
    text: {
      required: true,
      type: String,
    },
  },
};
</script>
