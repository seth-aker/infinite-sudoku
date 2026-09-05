import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

enum AppIcons { home, settings, back, pencil, undo, redo, reset, auth, logout }

const Map<AppIcons, IconData> cupertinoIconMap = {
  AppIcons.home: CupertinoIcons.home,
  AppIcons.settings: CupertinoIcons.settings,
  AppIcons.back: CupertinoIcons.back,
  AppIcons.pencil: CupertinoIcons.pencil,
  AppIcons.undo: CupertinoIcons.arrow_uturn_left,
  AppIcons.redo: CupertinoIcons.arrow_uturn_right,
  AppIcons.reset: CupertinoIcons.restart,
  AppIcons.auth: CupertinoIcons.person_circle,
  AppIcons.logout: CupertinoIcons.square_arrow_left,
};

const Map<AppIcons, IconData> materialIconMap = {
  AppIcons.home: Icons.home,
  AppIcons.settings: Icons.settings,
  AppIcons.back: Icons.arrow_back,
  AppIcons.pencil: Icons.edit,
  AppIcons.undo: Icons.undo,
  AppIcons.redo: Icons.redo,
  AppIcons.reset: Icons.replay,
  AppIcons.auth: Icons.person,
  AppIcons.logout: Icons.logout,
};
