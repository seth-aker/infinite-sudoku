import 'package:infinite_sudoku/domain/models/difficulty.dart';
import 'package:infinite_sudoku/routing/routes.dart';
import 'package:infinite_sudoku/ui/core/app_theme.dart';
import 'package:infinite_sudoku/ui/core/icons/app_icons.dart';
import 'package:infinite_sudoku/ui/core/spacing/app_spacing.dart';
import 'package:infinite_sudoku/ui/core/widgets/app_icon.dart';
import 'package:infinite_sudoku/ui/core/widgets/button.dart';
import 'package:infinite_sudoku/ui/core/widgets/shared_page_layout.dart';
import 'package:infinite_sudoku/ui/sudoku/state/puzzle/puzzle_bloc.dart';
import 'package:infinite_sudoku/ui/sudoku/state/timer/timer_bloc.dart';
import 'package:infinite_sudoku/ui/user/state/user_bloc.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

class HomeView extends StatelessWidget {
  const HomeView({super.key});
  @override
  Widget build(BuildContext context) {
    final hasCurrentPuzzle = context.select<PuzzleBloc, bool>((bloc) {
      final state = bloc.state;
      if (state.status == .loaded) {
        return state.puzzle?.puzzleId.isNotEmpty ?? false;
      } else {
        return false;
      }
    });
    return SharedPageLayout(
      title: '',
      leading: CupertinoButton(
        child: const AppIcon(AppIcons.auth),
        onPressed: () {
          if (context.read<UserBloc>().state.status == .authenticated) {
            context.push(Routes.settings);
          } else {
            context.push(Routes.login);
          }
        },
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.two),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.start,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.half),
                child: Text(
                  'Sudoku',
                  style: TextStyle(
                    fontSize: AppSpacing.two,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.primary(),
                  ),
                ),
              ),
            ),
            Container(
              decoration: BoxDecoration(
                border: Border.all(color: AppTheme.foreground(context)),
                borderRadius: BorderRadius.all(Radius.circular(AppSpacing.one)),
              ),
              padding: EdgeInsets.all(AppSpacing.one),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.center,
                spacing: AppSpacing.half,
                children: [
                  if (hasCurrentPuzzle)
                    SizedBox(
                      width: AppSpacing.twelve,
                      child: Button.primary(
                        onPressed: () {
                          context.push(Routes.sudoku);
                        },
                        child: const Text("Resume puzzle"),
                      ),
                    ),
                  ...DifficultyRating.values.map((rating) {
                    return SizedBox(
                      width: AppSpacing.twelve,
                      child: Button.primary(
                        onPressed: () {
                          if (hasCurrentPuzzle) {
                            _showConfirmOverwritePuzzle(context, rating);
                            return;
                          } else {
                            context.read<PuzzleBloc>().add(
                              NewPuzzleFetched(difficultyRating: rating),
                            );
                            context.push(Routes.sudoku, extra: rating);
                          }
                        },
                        child: Text(rating.toString()),
                      ),
                    );
                  }),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

Future<void> _showConfirmOverwritePuzzle(
  BuildContext context,
  DifficultyRating rating,
) {
  return showCupertinoDialog(
    context: context,
    builder: ((context) {
      return CupertinoAlertDialog(
        title: const Text("Overwrite current puzzle?"),
        content: Text(
          "You have a puzzle currently in progress. Do you "
          "want to delete your progress and start a new puzzle?",
        ),
        actions: [
          CupertinoDialogAction(
            onPressed: () => context.pop(),
            isDefaultAction: true,
            child: const Text("No"),
          ),
          CupertinoDialogAction(
            onPressed: () {
              context.read<PuzzleBloc>().add(
                NewPuzzleFetched(difficultyRating: rating),
              );
              context.read<TimerBloc>().add(const TimerReset());
              context.replace(Routes.sudoku, extra: rating);
            },
            isDestructiveAction: true,
            child: const Text("Yes"),
          ),
        ],
      );
    }),
  );
}
