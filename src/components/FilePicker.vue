<template>
  <div>
    <label class="label-button"
      >上传图片/文档
      <input type="file" multiple @change="onChange" />
    </label>
    <span
      v-if="previewNames.length"
      style="margin-left: 10px; font-size: 12px; color: #666"
      >已选：{{ previewNames.join("，") }}</span
    >
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

const emit = defineEmits<{
  (
    e: "picked",
    payload: {
      images: string[];
      files: { name: string; type: string; dataUrl: string }[];
    }
  ): void;
}>();
const previewNames = ref<string[]>([]);

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function onChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = input.files ? Array.from(input.files) : [];
  previewNames.value = files.map((f) => f.name);

  const images: string[] = [];
  const others: { name: string; type: string; dataUrl: string }[] = [];

  for (const f of files) {
    const dataUrl = await fileToDataUrl(f);
    if (f.type.startsWith("image/")) images.push(dataUrl);
    else others.push({ name: f.name, type: f.type, dataUrl });
  }

  emit("picked", { images, files: others });
}
</script>
