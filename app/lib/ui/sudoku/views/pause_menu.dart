import 'package:app/routing/routes.dart';
import 'package:app/ui/core/app_theme.dart';
import 'package:app/ui/core/icons/app_icons.dart';
import 'package:app/ui/core/spacing/app_spacing.dart';
import 'package:app/ui/core/widgets/app_icon.dart';
import 'package:app/ui/core/widgets/shared_page_layout.dart';
import 'package:app/ui/sudoku/state/puzzle/puzzle_bloc.dart';
import 'package:app/ui/sudoku/state/timer/timer_bloc.dart';
import 'package:app/ui/user/state/preferences_cubit.dart';
import 'package:app/utils/format_duration.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

class PauseMenu extends StatelessWidget {
  const PauseMenu({super.key});

  @override
  Widget build(BuildContext context) {
    final autoCandidateModeOn = context.select<PreferencesCubit, bool>((cubit) {
      return cubit.state.autoCandidateModeOn;
    });
    final totalMoves = context.select<PuzzleBloc, int>((bloc) {
      final state = bloc.state;
      return state is PuzzlePlayingState ? state.moveCount : 0;
    });
    final percentComplete = context.select<PuzzleBloc, double>((bloc) {
      final state = bloc.state;
      if (state is PuzzlePlayingState) {
        var originalEmptyCellCount = 0;
        var currentEmptyCellCount = 0;
        for (final cell in state.originalCells) {
          if (cell.value == 0) originalEmptyCellCount++;
        }
        for (final cell in state.cells) {
          if (cell.value == 0) currentEmptyCellCount++;
        }
        return (originalEmptyCellCount - currentEmptyCellCount) /
            originalEmptyCellCount;
      } else {
        return 0;
      }
    });
    final elapsedTime = formatDuration(
      context.read<TimerBloc>().state.elapsedSeconds,
    );
    final gameStats = <String, String>{
      'Elapsed Time:': elapsedTime,
      'Total Moves:': totalMoves.toString(),
      'Percent Complete': '${percentComplete * 100}%',
    };
    return SharedPageLayout(
      title: "Game Paused",
      leading: CupertinoButton(
        padding: EdgeInsets.zero,
        onPressed: () {
          if (context.canPop()) {
            context.read<TimerBloc>().add(const TimerResumed());
            context.pop();
          } else {
            context.go(Routes.home);
          }
        },
        child: AppIcon(AppIcons.back),
      ),
      trailing: SizedBox.shrink(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CupertinoFormSection(
            header: Text('Game Stats'),
            children: List.generate(gameStats.length, (idx) {
              final title = gameStats.entries.elementAt(idx).key;
              final value = gameStats.entries.elementAt(idx).value;
              return Padding(
                padding: const EdgeInsets.all(AppSpacing.half),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [Text(title), Text(value)],
                ),
              );
            }),
          ),

          CupertinoFormSection(
            header: Text('Game Settings'),
            children: [
              CupertinoFormRow(
                prefix: Text('Auto Candidate Mode?'),
                child: CupertinoSwitch(
                  value: autoCandidateModeOn,
                  onChanged: ((bool value) => context.read<PuzzleBloc>().add(
                    AutoCandidateModeToggled(autoCandidateModeOn: value),
                  )),
                ),
              ),
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => showCupertinoModalPopup(
                  context: context,
                  builder: (context) {
                    return CupertinoActionSheet(
                      title: Text('Reset Game Board?'),
                      message: Text(
                        'This is a destructive action, all progress will be lost. Are you sure?',
                      ),
                      actions: [
                        CupertinoActionSheetAction(
                          onPressed: () => context.pop(),
                          child: Text(
                            'Cancel',
                            style: TextStyle(
                              color: AppTheme.foreground(context),
                            ),
                          ),
                        ),
                        CupertinoActionSheetAction(
                          isDestructiveAction: true,
                          onPressed: () {
                            context.read<PuzzleBloc>().add(
                              const ResetBoardRequested(),
                            );
                            context.pop();
                          },
                          child: Text('Reset'),
                        ),
                      ],
                    );
                  },
                ),
                child: CupertinoFormRow(
                  prefix: Expanded(child: Text('Reset Game Board')),
                  child: AppIcon(AppIcons.reset),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
