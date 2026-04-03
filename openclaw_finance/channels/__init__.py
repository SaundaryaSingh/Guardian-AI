"""Chat channels module with plugin architecture."""

from openclaw_finance.channels.base import BaseChannel
from openclaw_finance.channels.manager import ChannelManager

__all__ = ["BaseChannel", "ChannelManager"]
