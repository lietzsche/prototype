import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  addComment,
  addReply,
  deleteComment,
  deletePost,
  getReplies,
  getComments,
  getPost,
  type Comment,
  type Post,
  isLoggedIn,
  updatePost,
} from '../api'

function BoardDetailPage() {
  const { id } = useParams()
  const postId = Number(id)
  const navigate = useNavigate()
  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [replies, setReplies] = useState<Record<number, Comment[]>>({})
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [replyText, setReplyText] = useState<Record<number, string>>({})
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const authed = isLoggedIn()

  useEffect(() => {
    let mounted = true
    setLoading(true)
    Promise.all([getPost(postId), getComments(postId)])
      .then(([p, cs]) => {
        if (!mounted) return
        setPost(p)
        setComments(cs)
      })
      .catch((e) => mounted && setError(e.message))
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [postId])

  const handleDeletePost = async () => {
    if (!confirm('Delete this post?')) return
    try {
      await deletePost(postId)
      navigate('/boards')
    } catch (e: any) {
      alert(e.message || 'Failed to delete')
    }
  }

  const handleAddComment = async () => {
    const content = commentText.trim()
    if (!content) return
    try {
      const c = await addComment(postId, { content })
      setComments((prev) => [...prev, c])
      setCommentText('')
    } catch (e: any) {
      alert(e.message || 'Failed to comment')
    }
  }

  const handleDeleteComment = async (cid: number) => {
    if (!confirm('Delete this comment?')) return
    try {
      await deleteComment(postId, cid)
      setComments((prev) => prev.filter((c) => c.id !== cid))
      // remove from replies map (if deleting a top-level comment, backend deletes nested too)
      setReplies((prev) => {
        const copy = { ...prev }
        delete copy[cid]
        return copy
      })
    } catch (e: any) {
      alert(e.message || 'Failed to delete')
    }
  }

  const toggleReplies = async (parentId: number) => {
    setExpanded((prev) => ({ ...prev, [parentId]: !prev[parentId] }))
    // lazy load only once
    if (!replies[parentId]) {
      try {
        const rs = await getReplies(postId, parentId)
        setReplies((prev) => ({ ...prev, [parentId]: rs }))
      } catch (e: any) {
        alert(e.message || 'Failed to load replies')
      }
    }
  }

  const handleAddReply = async (parentId: number) => {
    const content = (replyText[parentId] || '').trim()
    if (!content) return
    try {
      const r = await addReply(postId, parentId, { content })
      setReplies((prev) => ({ ...prev, [parentId]: [...(prev[parentId] || []), r] }))
      setReplyText((prev) => ({ ...prev, [parentId]: '' }))
      setExpanded((prev) => ({ ...prev, [parentId]: true }))
    } catch (e: any) {
      alert(e.message || 'Failed to add reply')
    }
  }

  const handleDeleteReply = async (replyId: number, parentId: number) => {
    if (!confirm('Delete this reply?')) return
    try {
      await deleteComment(postId, replyId)
      setReplies((prev) => ({ ...prev, [parentId]: (prev[parentId] || []).filter((r) => r.id !== replyId) }))
    } catch (e: any) {
      alert(e.message || 'Failed to delete')
    }
  }

  const startEdit = () => {
    if (!post) return
    setEditTitle(post.title)
    setEditContent(post.content)
    setEditing(true)
  }

  const submitEdit = async () => {
    try {
      const updated = await updatePost(postId, { title: editTitle, content: editContent })
      setPost(updated)
      setEditing(false)
    } catch (e: any) {
      alert(e.message || 'Failed to update')
    }
  }

  if (loading) return <div className="main-container"><p>Loading...</p></div>
  if (error) return <div className="main-container"><p className="text-red-600">{error}</p></div>
  if (!post) return <div className="main-container"><p>Post not found</p></div>

  return (
    <div className="main-container">
      <div className="mb-4">
        <Link to="/boards" className="link">← Back to list</Link>
      </div>
      {!editing ? (
        <>
          <h2 className="text-2xl font-semibold mb-1">{post.title}</h2>
          <div className="text-sm text-gray-600 mb-4">by {post.author} • {new Date(post.createdAt).toLocaleString()}</div>
          <p className="whitespace-pre-wrap">{post.content}</p>
          {authed && (
            <div className="mt-4 flex gap-2">
              <button onClick={startEdit} className="button-primary">Edit</button>
              <button onClick={handleDeletePost} className="bg-red-600 text-white rounded p-2 hover:bg-red-700">Delete</button>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <input className="form-field" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
          <textarea className="form-field min-h-40" value={editContent} onChange={(e) => setEditContent(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={submitEdit} className="button-primary">Save</button>
            <button onClick={() => setEditing(false)} className="border rounded p-2">Cancel</button>
          </div>
        </div>
      )}

      <h3 className="text-xl font-medium mt-8 mb-2">Comments</h3>
      <ul className="space-y-3">
        {comments.map((c) => (
          <li key={c.id} className="border rounded p-3 bg-gray-50">
            <div className="text-sm text-gray-600 mb-1">{c.author} • {new Date(c.createdAt).toLocaleString()}</div>
            <div className="whitespace-pre-wrap mb-2">{c.content}</div>
            <div className="flex items-center gap-3">
              <button onClick={() => toggleReplies(c.id)} className="text-sm link">
                {expanded[c.id] ? 'Hide replies' : 'Show replies'}
              </button>
              {authed && (
                <button onClick={() => handleDeleteComment(c.id)} className="text-sm text-red-600 hover:underline">
                  Delete
                </button>
              )}
            </div>

            {expanded[c.id] && (
              <div className="mt-3 ml-4 border-l pl-4 space-y-3">
                {(replies[c.id] || []).map((r) => (
                  <div key={r.id} className="bg-white rounded p-2">
                    <div className="text-xs text-gray-600 mb-1">{r.author} • {new Date(r.createdAt).toLocaleString()}</div>
                    <div className="whitespace-pre-wrap">{r.content}</div>
                    {authed && (
                      <button onClick={() => handleDeleteReply(r.id, c.id)} className="mt-1 text-xs text-red-600 hover:underline">
                        Delete
                      </button>
                    )}
                  </div>
                ))}

                {authed ? (
                  <div className="flex gap-2">
                    <input
                      className="form-field flex-1"
                      placeholder="Write a reply"
                      value={replyText[c.id] || ''}
                      onChange={(e) => setReplyText((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    />
                    <button onClick={() => handleAddReply(c.id)} className="button-primary">Reply</button>
                  </div>
                ) : (
                  <p className="text-sm">Login to reply. <Link className="link" to="/login">Login</Link></p>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {authed ? (
        <div className="mt-4 flex gap-2">
          <input
            className="form-field flex-1"
            placeholder="Write a comment"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
          />
          <button onClick={handleAddComment} className="button-primary">Add</button>
        </div>
      ) : (
        <p className="mt-4">Login to comment. <Link className="link" to="/login">Login</Link></p>
      )}
    </div>
  )
}

export default BoardDetailPage
