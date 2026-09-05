import 'package:infinite_sudoku/domain/models/difficulty.dart';
import 'package:json_annotation/json_annotation.dart';
part 'puzzle_dto.g.dart';

@JsonSerializable(createJsonSchema: true)
class NewPuzzleDTO extends PuzzleDto {
  final String puzzleId;
  final String cells;
  final DifficultyRating rating;
  final int score;

  const NewPuzzleDTO(this.puzzleId, this.cells, this.rating, this.score);

  factory NewPuzzleDTO.fromJson(Map<String, dynamic> json) =>
      _$NewPuzzleDTOFromJson(json);
  Map<String, dynamic> toJson() => _$NewPuzzleDTOToJson(this);
  static const jsonSchema = _$NewPuzzleDTOJsonSchema;
}

@JsonSerializable(createJsonSchema: true)
class UserPuzzleDTO extends NewPuzzleDTO {
  final String originalCells;
  final String candidates;
  final int time;
  final bool isCompleted;
  final List<int>? actions;
  const UserPuzzleDTO(
    super.puzzleId,
    super.cells,
    this.originalCells,
    this.candidates,
    super.rating,
    super.score,
    this.time,
    this.isCompleted,
    this.actions,
  );

  factory UserPuzzleDTO.fromJson(Map<String, dynamic> json) =>
      _$UserPuzzleDTOFromJson(json);
  @override
  Map<String, dynamic> toJson() => _$UserPuzzleDTOToJson(this);
  static const jsonSchema = _$UserPuzzleDTOJsonSchema;
}

abstract class PuzzleDto {
  const PuzzleDto();
  factory PuzzleDto.newPuzzle(
    String puzzleId,
    String cells,
    DifficultyRating rating,
    int score,
  ) => NewPuzzleDTO(puzzleId, cells, rating, score);
  factory PuzzleDto.userPuzzle(
    String puzzleId,
    String cells,
    String originalCells,
    String candidates,
    DifficultyRating rating,
    int score,
    int time,
    bool isCompleted,
    List<int>? actions,
  ) => UserPuzzleDTO(
    puzzleId,
    cells,
    originalCells,
    candidates,
    rating,
    score,
    time,
    isCompleted,
    actions,
  );
}
