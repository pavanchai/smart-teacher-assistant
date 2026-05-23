import apiClient from './client';
import { Class, Section } from '../types';

export async function getClasses(): Promise<Class[]> {
  const response = await apiClient.get<Class[]>('/classes');
  return response.data;
}

export async function getClass(classId: string): Promise<Class> {
  const response = await apiClient.get<Class>(`/classes/${classId}`);
  return response.data;
}

export async function getSections(classId: string): Promise<Section[]> {
  const response = await apiClient.get<Section[]>(`/classes/${classId}/sections`);
  return response.data;
}

export async function getSection(sectionId: string): Promise<Section> {
  const response = await apiClient.get<Section>(`/sections/${sectionId}`);
  return response.data;
}
