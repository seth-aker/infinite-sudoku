import 'package:sudoku_app/domain/models/difficulty.dart';
import 'package:sudoku_app/domain/models/puzzle.dart';
import 'package:sudoku_app/utils/result.dart';

abstract class PuzzleService {
  Future<Result<Puzzle>> getNewPuzzle(DifficultyRating difficulty);
  Future<Result<Puzzle>> getPuzzle(String puzzleId);
  Future<Result<void>> saveProgress(Puzzle state);
}
