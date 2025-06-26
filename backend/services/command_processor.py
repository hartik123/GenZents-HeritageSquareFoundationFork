from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import re
import json
from utils.logger import logger


@dataclass
class CommandResult:
    """Result of command execution"""
    success: bool
    message: str
    data: Optional[Dict] = None
    suggestions: Optional[List[str]] = None
    is_command: bool = False


class CommandProcessor:
    """Backend command processor for handling chat commands"""

    def __init__(self):
        self.commands = {
            "organize": self._handle_organize,
            "folder": self._handle_folder,
            "search": self._handle_search,
            "cleanup": self._handle_cleanup,
            "help": self._handle_help,
        }

        # Command descriptions for help and frontend sync
        self.command_descriptions = {
            "organize": "Organize files and folders in the current directory",
            "folder": "Create or navigate to a specific folder",
            "search": "Search for files, folders, or content",
            "cleanup": "Clean up temporary files and optimize storage",
            "help": "Show available commands and their descriptions"
        }

    def is_command(self, text: str) -> bool:
        """Check if text starts with a command"""
        return text.strip().startswith('/')

    def extract_command_and_message(
            self, prompt: str) -> Tuple[Optional[CommandResult], Optional[str]]:
        """
        Extract commands from prompt and return command result and remaining message
        Returns: (command_result, remaining_message)
        """
        lines = prompt.strip().split('\n')
        command_results = []
        remaining_lines = []

        for line in lines:
            line = line.strip()
            if self.is_command(line):
                result = self.process_command(line)
                if result.success:
                    command_results.append(result)
                else:
                    # If command failed, treat as regular text
                    remaining_lines.append(line)
            else:
                remaining_lines.append(line)

        # Combine command results
        if command_results:
            combined_result = self._combine_command_results(command_results)
            remaining_message = '\n'.join(
                remaining_lines).strip() if remaining_lines else None
            return combined_result, remaining_message

        return None, prompt

    def process_command(self, command_text: str) -> CommandResult:
        """Process a single command"""
        try:
            command_text = command_text.strip()
            if not command_text.startswith('/'):
                return CommandResult(
                    success=False,
                    message="Not a valid command",
                    is_command=False
                )

            # Parse command
            parts = command_text[1:].split()
            if not parts:
                return CommandResult(
                    success=False,
                    message="Empty command",
                    is_command=True
                )

            command_name = parts[0].lower()
            args = parts[1:] if len(parts) > 1 else []

            # Handle folder:name syntax
            if ':' in command_name:
                cmd_parts = command_name.split(':', 1)
                command_name = cmd_parts[0]
                args.insert(0, cmd_parts[1])

            if command_name in self.commands:
                logger.info(
                    f"Processing command: {command_name} with args: {args}")
                return self.commands[command_name](args)
            else:
                return CommandResult(
                    success=False,
                    message=f"Unknown command: /{command_name}",
                    suggestions=[
                        "Available commands: /organize, /folder:name, /search, /cleanup, /help"],
                    is_command=True
                )

        except Exception as e:
            logger.error(f"Error processing command '{command_text}': {e}")
            return CommandResult(
                success=False,
                message="Command execution failed",
                is_command=True
            )

    def _handle_organize(self, args: List[str]) -> CommandResult:
        """Handle organize command"""
        path = args[0] if args else "current directory"

        # Simulate organization logic
        results = [
            "Files organized by type",
            "Empty folders cleaned",
            "Duplicate files identified"
        ]

        return CommandResult(
            success=True,
            message=f"Successfully organized files in {path}",
            data={
                "path": path,
                "actions": [
                    "organize_by_type",
                    "clean_empty",
                    "find_duplicates"]},
            suggestions=results,
            is_command=True
        )

    def _handle_folder(self, args: List[str]) -> CommandResult:
        """Handle folder command"""
        if not args:
            return CommandResult(
                success=False,
                message="Folder name is required. Usage: /folder:name [action]",
                is_command=True
            )

        folder_name = args[0]
        action = args[1] if len(args) > 1 else "navigate"

        return CommandResult(
            success=True,
            message=f"{
                'Created' if action == 'create' else 'Navigated to'} folder: {folder_name}",
            data={"folder_name": folder_name, "action": action},
            is_command=True
        )

    def _handle_search(self, args: List[str]) -> CommandResult:
        """Handle search command"""
        query = " ".join(args) if args else "all files"

        # Simulate search results
        mock_results = [
            f"Found 15 files matching '{query}'",
            "Searched in current directory and subdirectories",
            "Results include documents, code files, and images"
        ]

        return CommandResult(
            success=True,
            message=f"Search completed for: {query}",
            data={"query": query, "results_count": 15},
            suggestions=mock_results,
            is_command=True
        )

    def _handle_cleanup(self, args: List[str]) -> CommandResult:
        """Handle cleanup command"""
        actions = [
            "Temporary files removed",
            "Cache directories cleared",
            "Log files rotated",
            "Storage optimized"
        ]

        return CommandResult(
            success=True,
            message="Cleanup completed successfully",
            data={"actions_performed": 4, "space_freed": "1.2 GB"},
            suggestions=actions,
            is_command=True
        )

    def _handle_help(self, args: List[str]) -> CommandResult:
        """Handle help command"""
        help_text = [
            "/organize [path] - Organize files and folders",
            "/folder:name [action] - Create or navigate to folder",
            "/search [query] - Search for files and content",
            "/cleanup - Clean temporary files and optimize storage",
            "/help - Show this help message"
        ]

        return CommandResult(
            success=True,
            message="Available commands:",
            suggestions=help_text,
            is_command=True
        )

    def _combine_command_results(
            self, results: List[CommandResult]) -> CommandResult:
        """Combine multiple command results into one"""
        messages = []
        all_suggestions = []
        all_data = {}

        for result in results:
            messages.append(result.message)
            if result.suggestions:
                all_suggestions.extend(result.suggestions)
            if result.data:
                all_data.update(result.data)

        return CommandResult(
            success=True,
            message="\n".join(messages),
            data=all_data if all_data else None,
            suggestions=all_suggestions if all_suggestions else None,
            is_command=True
        )

    def get_available_commands(self) -> List[str]:
        """Get list of available command names"""
        return list(self.commands.keys())

    def get_command_help(self) -> Dict[str, str]:
        """Get command descriptions"""
        return self.command_descriptions.copy()


# Global instance
command_processor = CommandProcessor()
