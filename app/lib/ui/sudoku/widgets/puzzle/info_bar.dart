import 'package:infinite_sudoku/ui/core/app_theme.dart';
import 'package:infinite_sudoku/ui/core/spacing/app_spacing.dart';
import 'package:infinite_sudoku/ui/sudoku/state/timer/timer_bloc.dart';
import 'package:infinite_sudoku/utils/format_duration.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class InfoBar extends StatelessWidget {
  const InfoBar({super.key});

  @override
  Widget build(BuildContext context) {
    final elapsedSecs = context.select<TimerBloc, int>(
      (bloc) => bloc.state.elapsedSeconds,
    );
    return ColoredBox(
      color: AppTheme.accent(context),
      child: Padding(
        padding: EdgeInsetsGeometry.symmetric(vertical: AppSpacing.half),
        child: Center(
          child: Text(
            formatDuration(elapsedSecs),
            style: TextStyle(
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ),
      ),
    );
  }
}
