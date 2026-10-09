part of 'puzzle_bloc.dart';

abstract class PuzzleEvent extends Equatable {
  const PuzzleEvent();
}

class NewPuzzleFetched extends PuzzleEvent {
  const NewPuzzleFetched({required this.difficultyRating});
  final DifficultyRating difficultyRating;
  @override
  List<Object?> get props => [difficultyRating];
}

class PuzzleFetched extends PuzzleEvent {
  const PuzzleFetched({required this.puzzleId});
  final String puzzleId;

  @override
  List<Object?> get props => [puzzleId];
}

class CellSelected extends PuzzleEvent {
  const CellSelected({required this.selectedIdx});

  final int? selectedIdx;
  @override
  List<Object?> get props => [selectedIdx];
}

class PencilToggled extends PuzzleEvent {
  const PencilToggled();
  @override
  List<Object?> get props => [];
}

class NumberPressed extends PuzzleEvent {
  final int value;
  const NumberPressed({required this.value});

  @override
  List<Object?> get props => [value];
}

class CellCleared extends PuzzleEvent {
  final int idx;

  const CellCleared({required this.idx});

  @override
  List<Object?> get props => [idx];
}

class UndoPressed extends PuzzleEvent {
  const UndoPressed();
  @override
  List<Object?> get props => [];
}

class RedoPressed extends PuzzleEvent {
  const RedoPressed();
  @override
  List<Object?> get props => [];
}

class AutoCandidateModeToggled extends PuzzleEvent {
  final bool autoCandidateModeOn;
  const AutoCandidateModeToggled({required this.autoCandidateModeOn});
  @override
  List<Object?> get props => [];
}

class ResetBoardRequested extends PuzzleEvent {
  const ResetBoardRequested();
  @override
  List<Object?> get props => [];
}

class SavePuzzleRequested extends PuzzleEvent {
  final int elapsedSeconds;
  const SavePuzzleRequested({required this.elapsedSeconds});
  @override
  List<Object?> get props => [elapsedSeconds];
}

class PuzzleClearRequested extends PuzzleEvent {
  const PuzzleClearRequested();

  @override
  List<Object?> get props => [];
}
