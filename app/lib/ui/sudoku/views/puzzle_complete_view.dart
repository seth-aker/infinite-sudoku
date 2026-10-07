import 'package:flutter/cupertino.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:infinite_sudoku/routing/routes.dart';
import 'package:infinite_sudoku/ui/core/app_theme.dart';
import 'package:infinite_sudoku/ui/core/spacing/app_spacing.dart';
import 'package:infinite_sudoku/ui/core/widgets/button.dart';
import 'package:infinite_sudoku/ui/sudoku/state/puzzle/puzzle_bloc.dart';
import 'package:infinite_sudoku/ui/sudoku/state/timer/timer_bloc.dart';
import 'package:infinite_sudoku/utils/format_duration.dart';

Future<void> showPuzzleCompleteDialog(BuildContext context) async {
  final puzzleBloc = context.read<PuzzleBloc>();
  final puzzle = puzzleBloc.state.puzzle;
  if (puzzle == null) return;
  return showCupertinoSheet(
    context: context,
    scrollableBuilder: ((context, scrollController) {
      final totalTime = context.read<TimerBloc>().state.elapsedSeconds;
      final totalMoves = puzzleBloc.state.moveCount;
      final rating = puzzle.rating;
      return LayoutBuilder(
        builder: ((context, constraints) => SingleChildScrollView(
          controller: scrollController,
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: constraints.maxHeight),
            child: ColoredBox(
              color: AppTheme.background(context),
              child: Column(
                children: [
                  const Text(
                    "Puzzle Complete!",
                    style: TextStyle(fontSize: AppSpacing.four),
                  ),
                  Text("Total Time: ${formatDuration(totalTime)}"),
                  Text("Total Moves: $totalMoves"),
                  Button.primary(
                    onPressed: () {
                      puzzleBloc.add(
                        NewPuzzleFetched(difficultyRating: rating),
                      );
                      context.pop();
                    },
                    child: Text("New $rating puzzle"),
                  ),
                  Button.primary(
                    onPressed: () {
                      puzzleBloc.add(const PuzzleClearRequested());
                      context.push(Routes.home);
                    },
                    child: const Text("Home"),
                  ),
                ],
              ),
            ),
          ),
        )),
      );
    }),
  );
}
