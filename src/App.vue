<template>
  <div class="h-screen w-screen flex flex-col bg-[#f5f5f7] dark:bg-[#1c1c1e] text-slate-900 dark:text-white/90 overflow-hidden font-sans transition-colors duration-200">
    <!-- Top Header -->
    <Header />

    <!-- Navigation Tabs -->
    <Navigation />

    <!-- Main Dynamic Workspace -->
    <main class="flex-1 overflow-hidden relative bg-[#f5f5f7] dark:bg-[#1c1c1e]">
      <transition name="fade" mode="out-in">
        <AgentsView v-if="store.currentTab === 'agents'" />
        <SkillsMatrix v-else-if="store.currentTab === 'skills' || store.currentTab === 'unmanaged'" />
        <SyncView v-else-if="store.currentTab === 'sync'" />
        <ProjectsView v-else-if="store.currentTab === 'projects'" />
      </transition>
    </main>

    <!-- Global Modals & Notifications -->
    <AddAgentModal />
    <SkillEditorModal />
    <AddProjectModal />
    <DiffModal />
    <SettingsModal />
    <ToastContainer />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useAppStore } from './stores/useAppStore';
import Header from './components/Header.vue';
import Navigation from './components/Navigation.vue';
import AgentsView from './components/AgentsView.vue';
import SkillsMatrix from './components/SkillsMatrix.vue';
import SyncView from './components/SyncView.vue';
import ProjectsView from './components/ProjectsView.vue';
import AddAgentModal from './components/AddAgentModal.vue';
import SkillEditorModal from './components/SkillEditorModal.vue';
import AddProjectModal from './components/AddProjectModal.vue';
import DiffModal from './components/DiffModal.vue';
import SettingsModal from './components/SettingsModal.vue';
import ToastContainer from './components/ToastContainer.vue';

const store = useAppStore();

onMounted(() => {
  store.init();
});
</script>

