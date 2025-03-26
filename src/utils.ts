import fs from 'fs/promises'
import yaml from 'yaml'
import { CourseSlug, storeIds } from './config'

export async function readYamlFile<T>(filePath: string): Promise<T> {
  const fileContent = await fs.readFile(filePath, 'utf-8')
  return yaml.parse(fileContent) as T
}

export function isCourseSlug(slug: string): slug is CourseSlug {
  return slug in storeIds
}
