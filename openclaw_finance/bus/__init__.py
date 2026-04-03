"""Message bus module for decoupled channel-agent communication."""

from openclaw_finance.bus.events import InboundMessage, OutboundMessage
from openclaw_finance.bus.queue import MessageBus

__all__ = ["MessageBus", "InboundMessage", "OutboundMessage"]
