import 'package:infinite_sudoku/routing/routes.dart';
import 'package:infinite_sudoku/ui/core/app_theme.dart';
import 'package:infinite_sudoku/ui/core/colors/app_colors.dart';
import 'package:infinite_sudoku/ui/core/constants.dart';
import 'package:infinite_sudoku/ui/core/icons/app_icons.dart';
import 'package:infinite_sudoku/ui/core/widgets/app_icon.dart';
import 'package:infinite_sudoku/ui/sudoku/state/timer/timer_bloc.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

class SharedPageLayout extends StatelessWidget {
  final Widget child;
  final Widget? leading;
  final Widget? trailing;
  final String title;
  const SharedPageLayout({
    required this.child,
    required this.title,
    this.leading,
    this.trailing,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    if (isApple) {
      return CupertinoLayout(
        title: title,
        leading: leading,
        trailing: trailing,
        child: child,
      );
    } else {
      return MaterialLayout(
        title: title,
        leading: leading,
        trailing: trailing,
        child: child,
      );
    }
  }
}

class CupertinoLayout extends StatelessWidget {
  final Widget child;
  final String title;

  final Widget? leading;
  final Widget? trailing;

  const CupertinoLayout({
    super.key,
    required this.child,
    required this.title,
    this.leading,
    this.trailing,
  });
  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      navigationBar: CupertinoNavigationBar(
        leading:
            leading ??
            CupertinoButton(
              padding: EdgeInsets.zero,
              child: const AppIcon(AppIcons.home),
              onPressed: () => context.go(Routes.home),
            ),
        middle: Text(title),
        trailing:
            trailing ??
            CupertinoButton(
              padding: EdgeInsets.zero,
              child: const AppIcon(AppIcons.settings),
              onPressed: () {
                context.read<TimerBloc>().add(const TimerPaused());
                context.push(Routes.settings);
              },
            ),
      ),
      backgroundColor: AppTheme.background(context),
      child: SafeArea(bottom: false, child: child),
    );
  }
}

class MaterialLayout extends StatelessWidget {
  final Widget child;
  final String title;
  final Widget? leading;
  final Widget? trailing;
  const MaterialLayout({
    super.key,
    required this.child,
    required this.title,
    this.leading,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: MaterialButton(
          padding: EdgeInsets.zero,
          child: const AppIcon(AppIcons.home),
          onPressed: () {
            context.go(Routes.home);
          },
        ),
        title: const Text('Sudoku'),
      ),
      drawer: Drawer(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            const DrawerHeader(
              decoration: BoxDecoration(color: AppColors.primary),
              child: Text('Settings'),
            ),
            ListTile(title: const Text('Does something')),
          ],
        ),
      ),
      body: child,
    );
  }
}
