import { SudokuServiceImplementation } from "../service/sudokuServiceImplementation.ts";
import SudokuRouter from "./sudokuRouter.ts";
import { PgSudokuDataSource } from "../datasource/pgSudokuDataSource.ts";
import sql from "@/core/dataSource/postgres.ts";

const sudokuDataSource = PgSudokuDataSource.create(sql)
const dataService = SudokuServiceImplementation.create(sudokuDataSource);

export const sudokuRouter = SudokuRouter(dataService)
