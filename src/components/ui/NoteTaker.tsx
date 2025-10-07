
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StickyNote, Plus, Save, X, Edit3, Trash2, PlusCircle, Bold, Italic, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Quote, Hash, Zap, Type, Palette, FileText, Calendar, Users, CheckSquare, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Note {
  id: string;
  content: string;
  rawContent?: string;
  timestamp: Date;
  isRichText: boolean;
  formatting?: {
    isBold?: boolean;
    isItalic?: boolean;
    alignment?: 'left' | 'center' | 'right';
    listType?: 'bullet' | 'numbered' | 'none';
  };
  style?: {
    backgroundColor?: string;
    textColor?: string;
  };
}

interface StickyNote {
  id: string;
  content: string;
  x: number;
  y: number;
  timestamp: Date;
  color: string;
}

interface NoteTakerProps {
  className?: string;
}

export const NoteTaker: React.FC<NoteTakerProps> = ({ className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [stickyNotes, setStickyNotes] = useState<StickyNote[]>([]);
  const [currentNote, setCurrentNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [showStickyDialog, setShowStickyDialog] = useState(false);
  const [newStickyContent, setNewStickyContent] = useState('');
  const [isRichTextMode, setIsRichTextMode] = useState(true);
  const [currentFormatting, setCurrentFormatting] = useState({
    isBold: false,
    isItalic: false,
    alignment: 'left' as 'left' | 'center' | 'right',
    listType: 'bullet' as 'bullet' | 'numbered' | 'none'
  });
  const [currentStyle, setCurrentStyle] = useState({
    backgroundColor: '#ffffff',
    textColor: '#374151'
  });
  const [showTemplates, setShowTemplates] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load notes from localStorage on component mount
  useEffect(() => {
    const savedNotes = localStorage.getItem('noteTaker-notes');
    const savedStickyNotes = localStorage.getItem('noteTaker-stickyNotes');
    
    if (savedNotes) {
      try {
        const parsedNotes = JSON.parse(savedNotes).map((note: any) => ({
          ...note,
          timestamp: new Date(note.timestamp)
        }));
        setNotes(parsedNotes);
      } catch (e) {
        console.error('Error loading notes:', e);
      }
    }

    if (savedStickyNotes) {
      try {
        const parsedStickyNotes = JSON.parse(savedStickyNotes).map((note: any) => ({
          ...note,
          timestamp: new Date(note.timestamp)
        }));
        setStickyNotes(parsedStickyNotes);
      } catch (e) {
        console.error('Error loading sticky notes:', e);
      }
    }
  }, []);

  // Save notes to localStorage whenever notes change
  useEffect(() => {
    localStorage.setItem('noteTaker-notes', JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem('noteTaker-stickyNotes', JSON.stringify(stickyNotes));
  }, [stickyNotes]);

  const applyAutoFormatting = (text: string): string => {
    if (!text.trim()) return '';
    
    let formatted = text;
    
    // Auto-detect and format headers
    formatted = formatted.replace(/^#\s+(.+)$/gm, '📋 **$1**');
    formatted = formatted.replace(/^##\s+(.+)$/gm, '▶️ **$1**');
    formatted = formatted.replace(/^###\s+(.+)$/gm, '🔹 **$1**');
    
    // Auto-format action items
    formatted = formatted.replace(/^\[\s*\]\s+(.+)$/gm, '☐ $1');
    formatted = formatted.replace(/^\[x\]\s+(.+)$/gm, '✅ $1');
    
    // Auto-format priorities
    formatted = formatted.replace(/!{3}\s*(.+)/g, '🔴 **HIGH:** $1');
    formatted = formatted.replace(/!{2}\s*(.+)/g, '🟡 **MEDIUM:** $1');
    formatted = formatted.replace(/!{1}\s*(.+)/g, '🟢 **LOW:** $1');
    
    // Auto-format dates
    formatted = formatted.replace(/(\d{1,2}\/\d{1,2}\/\d{4})/g, '📅 $1');
    formatted = formatted.replace(/(\d{4}-\d{2}-\d{2})/g, '📅 $1');
    
    // Auto-format bullets if listType is bullet
    if (currentFormatting.listType === 'bullet') {
      const lines = formatted.split('\n');
      formatted = lines.map(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.match(/^[•◦▪▫‣⁃✓✅☐🔴🟡🟢📋▶️🔹📅]/)) {
          if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
            return `• ${trimmed.substring(1).trim()}`;
          }
          return `• ${trimmed}`;
        }
        return line;
      }).join('\n');
    }
    
    // Auto-format numbered lists if listType is numbered
    if (currentFormatting.listType === 'numbered') {
      const lines = formatted.split('\n').filter(line => line.trim());
      formatted = lines.map((line, index) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.match(/^\d+\./)) {
          return `${index + 1}. ${trimmed.replace(/^[•\-\*]\s*/, '')}`;
        }
        return line;
      }).join('\n');
    }
    
    return formatted;
  };
  
  const renderFormattedContent = (content: string, formatting?: any, style?: any) => {
    const textAlign = formatting?.alignment || 'left';
    const backgroundColor = style?.backgroundColor || '#ffffff';
    const textColor = style?.textColor || '#374151';
    
    return (
      <div 
        className={cn(
          "whitespace-pre-line text-sm leading-relaxed p-3 rounded-lg border border-gray-100",
          textAlign === 'center' && "text-center",
          textAlign === 'right' && "text-right"
        )}
        style={{ 
          backgroundColor, 
          color: textColor,
          fontWeight: formatting?.isBold ? 'bold' : 'normal',
          fontStyle: formatting?.isItalic ? 'italic' : 'normal'
        }}
      >
        {content}
      </div>
    );
  };

  const saveNote = () => {
    if (!currentNote.trim()) return;
    
    const formattedContent = isRichTextMode ? applyAutoFormatting(currentNote) : currentNote;
    const newNote: Note = {
      id: Date.now().toString(),
      content: formattedContent,
      rawContent: currentNote,
      timestamp: new Date(),
      isRichText: isRichTextMode,
      formatting: { ...currentFormatting },
      style: { ...currentStyle }
    };

    if (editingNoteId) {
      setNotes(prev => prev.map(note => 
        note.id === editingNoteId 
          ? { ...note, content: formattedContent, rawContent: currentNote, formatting: { ...currentFormatting }, style: { ...currentStyle } }
          : note
      ));
      setEditingNoteId(null);
    } else {
      setNotes(prev => [newNote, ...prev]);
    }
    
    setCurrentNote('');
    // Reset formatting to defaults after saving
    setCurrentFormatting({
      isBold: false,
      isItalic: false, 
      alignment: 'left',
      listType: 'bullet'
    });
  };

  const editNote = (note: Note) => {
    setCurrentNote(note.rawContent || note.content);
    setEditingNoteId(note.id);
    if (note.formatting) {
      setCurrentFormatting(note.formatting);
    }
    if (note.style) {
      setCurrentStyle(note.style);
    }
    setIsRichTextMode(note.isRichText);
  };
  
  const toggleBold = () => {
    setCurrentFormatting(prev => ({ ...prev, isBold: !prev.isBold }));
  };
  
  const toggleItalic = () => {
    setCurrentFormatting(prev => ({ ...prev, isItalic: !prev.isItalic }));
  };
  
  const setAlignment = (alignment: 'left' | 'center' | 'right') => {
    setCurrentFormatting(prev => ({ ...prev, alignment }));
  };
  
  const setListType = (listType: 'bullet' | 'numbered' | 'none') => {
    setCurrentFormatting(prev => ({ ...prev, listType }));
  };
  
  const insertTemplate = (template: string) => {
    setCurrentNote(template);
    setShowTemplates(false);
  };
  
  const noteTemplates = {
    meeting: '📋 **Meeting Notes**\n\n📅 Date: \n👥 Attendees: \n\n🎯 **Agenda:**\n• \n• \n• \n\n📝 **Key Points:**\n• \n• \n\n✅ **Action Items:**\n☐ \n☐ ',
    todo: '✅ **Task List**\n\n🔴 **HIGH PRIORITY:**\n☐ \n\n🟡 **MEDIUM PRIORITY:**\n☐ \n☐ \n\n🟢 **LOW PRIORITY:**\n☐ \n☐ ',
    idea: '💡 **New Idea**\n\n🎯 **Concept:** \n\n📊 **Potential Impact:** \n\n⚡ **Next Steps:**\n• \n• \n\n🤔 **Considerations:**\n• \n• ',
    daily: `📅 **Daily Notes - ${new Date().toLocaleDateString()}**\n\n🌅 **Morning Priorities:**\n• \n• \n• \n\n📈 **Progress Made:**\n• \n• \n\n🔄 **Tomorrow:**\n• \n• `
  };

  const deleteNote = (noteId: string) => {
    setNotes(prev => prev.filter(note => note.id !== noteId));
  };

  const createStickyNote = () => {
    if (!newStickyContent.trim()) return;

    const colors = ['bg-yellow-200', 'bg-pink-200', 'bg-blue-200', 'bg-green-200', 'bg-purple-200'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newSticky: StickyNote = {
      id: Date.now().toString(),
      content: newStickyContent,
      x: Math.random() * (window.innerWidth - 200),
      y: Math.random() * (window.innerHeight - 150) + 100,
      timestamp: new Date(),
      color: randomColor
    };

    setStickyNotes(prev => [...prev, newSticky]);
    setNewStickyContent('');
    setShowStickyDialog(false);
  };

  const deleteStickyNote = (noteId: string) => {
    setStickyNotes(prev => prev.filter(note => note.id !== noteId));
  };

  return (
    <>
      {/* Floating Note Taker Button */}
      <Button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 rounded-full w-14 h-14 shadow-2xl",
          "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700",
          "text-white border-0 transition-all duration-300 hover:scale-110",
          className
        )}
        size="icon"
      >
        <StickyNote className="w-6 h-6" />
      </Button>

      {/* Note Taker Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="w-5 h-5 text-blue-600" />
              Smart Notes
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Note Input */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-gray-800">
                  {editingNoteId ? 'Edit Note' : 'Add New Note'}
                </h3>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => setShowStickyDialog(true)}
                    variant="outline" 
                    size="sm"
                    className="gap-2"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Sticky Note
                  </Button>
                  {editingNoteId && (
                    <Button 
                      onClick={() => {
                        setEditingNoteId(null);
                        setCurrentNote('');
                      }}
                      variant="outline" 
                      size="sm"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Rich Text Mode Toggle */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isRichTextMode}
                    onChange={(e) => setIsRichTextMode(e.target.checked)}
                    className="rounded"
                  />
                  Rich Text Mode
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="gap-1"
                >
                  <FileText className="w-3 h-3" />
                  Templates
                </Button>
              </div>

              {/* Template Selector */}
              {showTemplates && (
                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-lg border">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => insertTemplate(noteTemplates.meeting)}
                    className="justify-start gap-2"
                  >
                    <Users className="w-3 h-3" />
                    Meeting Notes
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => insertTemplate(noteTemplates.todo)}
                    className="justify-start gap-2"
                  >
                    <CheckSquare className="w-3 h-3" />
                    Todo List
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => insertTemplate(noteTemplates.idea)}
                    className="justify-start gap-2"
                  >
                    <Zap className="w-3 h-3" />
                    Idea Notes
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => insertTemplate(noteTemplates.daily)}
                    className="justify-start gap-2"
                  >
                    <Calendar className="w-3 h-3" />
                    Daily Log
                  </Button>
                </div>
              )}

              {/* Rich Text Toolbar */}
              {isRichTextMode && (
                <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-lg border">
                  {/* Formatting Controls */}
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant={currentFormatting.isBold ? "default" : "ghost"}
                      size="sm"
                      onClick={() => toggleBold()}
                      className="w-8 h-8 p-0"
                    >
                      <Bold className="w-3 h-3" />
                    </Button>
                    <Button
                      type="button"
                      variant={currentFormatting.isItalic ? "default" : "ghost"}
                      size="sm"
                      onClick={() => toggleItalic()}
                      className="w-8 h-8 p-0"
                    >
                      <Italic className="w-3 h-3" />
                    </Button>
                  </div>

                  {/* Alignment Controls */}
                  <div className="flex gap-1 border-l pl-2">
                    <Button
                      type="button"
                      variant={currentFormatting.alignment === 'left' ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setAlignment('left')}
                      className="w-8 h-8 p-0"
                    >
                      <AlignLeft className="w-3 h-3" />
                    </Button>
                    <Button
                      type="button"
                      variant={currentFormatting.alignment === 'center' ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setAlignment('center')}
                      className="w-8 h-8 p-0"
                    >
                      <AlignCenter className="w-3 h-3" />
                    </Button>
                    <Button
                      type="button"
                      variant={currentFormatting.alignment === 'right' ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setAlignment('right')}
                      className="w-8 h-8 p-0"
                    >
                      <AlignRight className="w-3 h-3" />
                    </Button>
                  </div>

                  {/* List Controls */}
                  <div className="flex gap-1 border-l pl-2">
                    <Button
                      type="button"
                      variant={currentFormatting.listType === 'bullet' ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setListType('bullet')}
                      className="w-8 h-8 p-0"
                    >
                      <List className="w-3 h-3" />
                    </Button>
                    <Button
                      type="button"
                      variant={currentFormatting.listType === 'numbered' ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setListType('numbered')}
                      className="w-8 h-8 p-0"
                    >
                      <ListOrdered className="w-3 h-3" />
                    </Button>
                  </div>

                  {/* Style Controls */}
                  <div className="flex gap-1 border-l pl-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentStyle(prev => ({ ...prev, backgroundColor: prev.backgroundColor === '#fef3c7' ? '' : '#fef3c7' }))}
                      className="w-8 h-8 p-0"
                      style={{ backgroundColor: currentStyle.backgroundColor === '#fef3c7' ? '#fef3c7' : '' }}
                    >
                      <Palette className="w-3 h-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-8 h-8 p-0"
                    >
                      <Type className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}

              <Textarea
                ref={textareaRef}
                placeholder={isRichTextMode ? "Type your rich text notes here... Use ** for bold, * for italic, # for headers, • for bullets" : "Type your notes here... (will be auto-formatted as bullet points)"}
                value={currentNote}
                onChange={(e) => setCurrentNote(e.target.value)}
                className={`min-h-24 ${isRichTextMode ? 'font-mono' : ''}`}
                rows={6}
                style={{
                  backgroundColor: currentStyle.backgroundColor || '',
                  color: currentStyle.textColor || '',
                  textAlign: currentFormatting.alignment as 'left' | 'center' | 'right'
                }}
              />

              {/* Live Preview for Rich Text */}
              {isRichTextMode && currentNote && (
                <div className="p-3 bg-slate-50 rounded border">
                  <div className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    Live Preview:
                  </div>
                  <div 
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: renderFormattedContent(applyAutoFormatting(currentNote)) }}
                  />
                </div>
              )}

              <Button 
                onClick={saveNote} 
                className="gap-2"
                disabled={!currentNote.trim()}
              >
                <Save className="w-4 h-4" />
                {editingNoteId ? 'Update Note' : 'Save Note'}
              </Button>
            </div>

            {/* Notes List */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                Your Notes
                <Badge variant="outline">{notes.length}</Badge>
              </h3>
              
              {notes.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No notes yet. Start taking notes!</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {notes.map((note) => (
                    <Card key={note.id} className="border border-gray-200">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            {note.isRichText ? (
                              <div 
                                className="prose prose-sm max-w-none text-sm mb-2"
                                dangerouslySetInnerHTML={{ __html: renderFormattedContent(note) }}
                                style={{
                                  backgroundColor: note.style?.backgroundColor || '',
                                  color: note.style?.textColor || '',
                                  textAlign: note.formatting?.alignment as 'left' | 'center' | 'right' || 'left'
                                }}
                              />
                            ) : (
                              <div className="whitespace-pre-line text-sm text-gray-700 mb-2">
                                {note.content}
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              {note.timestamp.toLocaleString()}
                              {note.isRichText && (
                                <Badge variant="outline" className="text-xs px-1 py-0">
                                  Rich Text
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              onClick={() => editNote(note)}
                              variant="ghost"
                              size="sm"
                            >
                              <Edit3 className="w-4 h-4" />
                            </Button>
                            <Button
                              onClick={() => deleteNote(note.id)}
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sticky Note Dialog */}
      <Dialog open={showStickyDialog} onOpenChange={setShowStickyDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Sticky Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Enter your sticky note content..."
              value={newStickyContent}
              onChange={(e) => setNewStickyContent(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2">
              <Button onClick={createStickyNote} disabled={!newStickyContent.trim()}>
                Create Sticky
              </Button>
              <Button variant="outline" onClick={() => setShowStickyDialog(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sticky Notes */}
      {stickyNotes.map((sticky) => (
        <StickyNoteComponent
          key={sticky.id}
          sticky={sticky}
          onDelete={() => deleteStickyNote(sticky.id)}
          onMove={(x, y) => {
            setStickyNotes(prev => prev.map(note => 
              note.id === sticky.id ? { ...note, x, y } : note
            ));
          }}
        />
      ))}
    </>
  );
};

interface StickyNoteComponentProps {
  sticky: StickyNote;
  onDelete: () => void;
  onMove: (x: number, y: number) => void;
}

const StickyNoteComponent: React.FC<StickyNoteComponentProps> = ({ 
  sticky, 
  onDelete, 
  onMove 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - sticky.x,
      y: e.clientY - sticky.y
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      onMove(e.clientX - dragStart.x, e.clientY - dragStart.y);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart]);

  return (
    <div
      className={cn(
        "fixed w-48 min-h-32 p-3 rounded-lg shadow-lg cursor-move z-40 border-2 border-gray-300",
        sticky.color,
        isDragging ? "scale-105 shadow-2xl" : ""
      )}
      style={{
        left: sticky.x,
        top: sticky.y,
        transform: isDragging ? 'rotate(-2deg)' : 'rotate(1deg)'
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="text-xs text-gray-600 font-medium">Note</div>
        <Button
          onClick={onDelete}
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 text-gray-600 hover:text-red-600"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
      <div className="text-sm text-gray-800 whitespace-pre-wrap">
        {sticky.content}
      </div>
      <div className="text-xs text-gray-500 mt-2">
        {sticky.timestamp.toLocaleDateString()}
      </div>
    </div>
  );
};
