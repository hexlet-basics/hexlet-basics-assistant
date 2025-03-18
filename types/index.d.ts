// Types go here

export interface Lesson {
  slug: string
  readmePath: string
  exercisePath: string
  codePath: string
  testPath: string
}

export interface Module {
  slug: string
  name: string
  description: string
  lessons: Lesson[]
}

export interface Course {
  slug: string
  name: string
  description: string
  modules: Module[]
}
