import * as git from 'isomorphic-git'
import fse from 'fs-extra'
import fsp from 'fs/promises'
import fs from 'fs'
import { pipeline } from 'stream/promises'
import os from 'node:os'
import path from 'node:path'
import http from 'isomorphic-git/http/node/index.js'
import { Course } from '../types'
import { readYamlFile } from './utils'
import OpenAI from 'openai'
import mergeStreams from '@sindresorhus/merge-streams'
import PQueue from 'p-queue'

async function cloneOrPull(lang: string): Promise<string> {
  const repositoryName = `/hexlet-basics/exercises-${lang}` // Change to your repository
  const repositoryUrl = `https://github.com/${repositoryName}`
  const dest = path.join(os.tmpdir(), repositoryName)

  console.log(`Repository: ${repositoryUrl}`)
  console.log(`Destination: ${dest}`)

  if (!(await fse.pathExists(dest))) {
    console.log('Cloning repository...')
    await git.clone({
      fs: fse,
      http,
      dir: dest,
      url: repositoryUrl,
      singleBranch: true,
      depth: 1,
    })
    console.log('Repository cloned')
  }
  else {
    console.log('Repository exists. Resetting to HEAD...')
    await git.checkout({
      fs: fse,
      dir: dest,
      ref: 'main', // Change if your default branch is different
    })

    await git.resetIndex({
      fs: fse,
      dir: dest,
      filepath: '.', // Reset all files
    })
  }

  return dest
}

async function readCourse(courseSlug: string, courseDir: string): Promise<Course> {
  const courseDescriptionPath = path.join(courseDir, 'description.ru.yml')
  const courseMetadata = await readYamlFile<{ header: string, description: string }>(
    courseDescriptionPath,
  )

  const modulesPath = path.join(courseDir, 'modules')
  const moduleDirs = await fsp.readdir(modulesPath)

  const filteredModuleDirs = moduleDirs.filter(dir => /^\d+-/.test(dir))
  const sortedModuleDirs = filteredModuleDirs.sort(
    (a, b) => Number(a.split('-')[0]) - Number(b.split('-')[0]),
  )
  // console.log(sortedModuleDirs)

  const modulePromises = sortedModuleDirs.map(async (moduleSlug) => {
    const modulePath = path.join(modulesPath, moduleSlug)
    const moduleDescriptionPath = path.join(modulePath, 'description.ru.yml')

    const moduleMetadata = await readYamlFile<{ name: string, description: string }>(
      moduleDescriptionPath,
    )

    const lessonDirs = await fsp.readdir(modulePath)
    const filteredLessonDirs = lessonDirs.filter(dir => /^\d+-/.test(dir))
    const sortedLessonDirs = filteredLessonDirs.sort(
      (a, b) => Number(a.split('-')[0]) - Number(b.split('-')[0]),
    )
    // console.log(sortedLessonDirs)

    const lessonPromises = sortedLessonDirs.map((lessonSlug) => {
      const lessonPath = path.join(modulePath, lessonSlug)
      const lessonRuPath = path.join(lessonPath, 'ru')

      const readmePath = path.join(lessonRuPath, 'README.md')
      const exercisePath = path.join(lessonRuPath, 'EXERCISE.md')
      const codePath = path.join(lessonPath, 'index.js')
      const testPath = path.join(lessonPath, 'test.js')

      return {
        slug: lessonSlug,
        readmePath,
        exercisePath,
        codePath,
        testPath,
      }
      // const readme = fsp.readFile(readmePath, 'utf-8')
      // const exercise = fsp.readFile(exercisePath, 'utf-8')
      // const code = fsp.readFile(codePath, 'utf-8')
      // const test = fsp.readFile(testPath, 'utf-8')

      // const [readmeContent, exerciseContent, codeContent, testContent] = await Promise.all([
      //   readme,
      //   exercise,
      //   code,
      //   test,
      // ])

      // return {
      //   readme: readmeContent.trim(),
      //   exercise: exerciseContent.trim(),
      //   code: codeContent.trim(),
      //   test: testContent.trim(),
      // }
    })

    const lessons = await Promise.all(lessonPromises)

    return {
      slug: moduleSlug,
      name: moduleMetadata.name,
      description: moduleMetadata.description,
      lessons,
    }
  })

  const modules = await Promise.all(modulePromises)

  return {
    name: courseMetadata.header,
    slug: courseSlug,
    description: courseMetadata.description,
    modules,
  }
}

export async function load(courseSlug: string) {
  const courseDir = await cloneOrPull(courseSlug)
  const course = await readCourse(courseSlug, courseDir)

  const client = new OpenAI()

  const storeId = 'vs_67d63d7f17b08191b48891045f2f2cb1'
  // const store = await client.vectorStores.retrieve(storeId)
  const storeFiles = await client.vectorStores.files.list(storeId)
  // console.log(storeFiles.data)
  for (const storeFile of storeFiles.data) {
    await client.vectorStores.files.del(storeId, storeFile.id)
  }

  for (const module of course.modules) {
    const queue = new PQueue({ concurrency: 5 })
    const promises = module.lessons.map(lesson => async () => {
      const mergedStream = mergeStreams([
        fs.createReadStream(lesson.readmePath),
        fs.createReadStream(lesson.exercisePath),
        fs.createReadStream(lesson.codePath),
        fs.createReadStream(lesson.testPath),
      ])

      const filename = `${course.slug}-${module.slug}-${lesson.slug}.txt`
      const tempFilePath = path.join(os.tmpdir(), filename)
      const writeStream = fs.createWriteStream(tempFilePath)
      await pipeline(mergedStream, writeStream)

      await client.vectorStores.files.uploadAndPoll(
        storeId,
        fs.createReadStream(tempFilePath),
      )
      console.log(filename)
    })
    await queue.addAll(promises)
  }

  // console.log(JSON.stringify(data, null, 2))
  // const { text } = await generateText({
  //   model: openai('o3-mini'),
  //   prompt: 'What is love?',
  // })
}
