<template>
  <div class="h-screen w-screen flex flex-col bg-slate-50 dark:bg-dark-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans">
    <!-- Top Header -->
    <Header />

    <!-- Navigation Tabs -->
    <Navigation />

    <!-- Main Dynamic Workspace -->
    <main class="flex-1 overflow-hidden relative">
      <transition name="fade" mode="out-in">
        <AgentsView v-if="store.currentTab === 'agents'" />
        <SkillsMatrix v-else-if="store.currentTab === 'skills' || store.currentTab === 'unmanaged'" />
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
