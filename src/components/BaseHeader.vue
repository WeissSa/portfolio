<template>
  <h1
    class="text-4xl ml-5 whitespace-pre-wrap sm:ml-0 sm:text-5xl text-gray-100 pt-5 pb-2 text-center w-screen bg-desaturated-purple shadow-md shadow-zinc-800"
  >
    {{ text }}
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
