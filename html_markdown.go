package main

import (
	"bytes"
	"fmt"
	"strings"

	"golang.org/x/net/html"
)

func htmlToMarkdown(input string) string {
	root, err := html.Parse(strings.NewReader(input))
	if err != nil {
		return input
	}
	var builder strings.Builder
	writeMarkdownNodes(&builder, root, 0)
	output := builder.String()
	output = regexpSpace.Replace(output)
	output = regexpHardSpace.Replace(output)
	return strings.TrimSpace(output)
}

var regexpSpace = strings.NewReplacer(
	"\n \n", "\n\n",
	"\n\n\n", "\n\n",
)

var regexpHardSpace = strings.NewReplacer(
	" \n", "\n",
	"\n ", "\n",
)

func writeMarkdownNodes(builder *strings.Builder, node *html.Node, listDepth int) {
	if node.Type == html.TextNode {
		text := strings.TrimSpace(node.Data)
		if text != "" {
			builder.WriteString(text)
		}
		return
	}
	if node.Type != html.ElementNode && node.Type != html.DocumentNode {
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			writeMarkdownNodes(builder, child, listDepth)
		}
		return
	}
	tag := strings.ToLower(node.Data)
	switch tag {
	case "script", "style", "head":
		return
	case "br":
		builder.WriteString("\n")
	case "p", "div", "section", "article":
		builder.WriteString("\n\n")
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			writeMarkdownNodes(builder, child, listDepth)
		}
		builder.WriteString("\n\n")
	case "h1", "h2", "h3", "h4", "h5", "h6":
		level := int(tag[1] - '0')
		builder.WriteString("\n\n" + strings.Repeat("#", level) + " ")
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			writeMarkdownNodes(builder, child, listDepth)
		}
		builder.WriteString("\n\n")
	case "strong", "b":
		builder.WriteString("**")
		writeMarkdownChildren(builder, node, listDepth)
		builder.WriteString("**")
	case "em", "i":
		builder.WriteString("*")
		writeMarkdownChildren(builder, node, listDepth)
		builder.WriteString("*")
	case "del", "s":
		builder.WriteString("~~")
		writeMarkdownChildren(builder, node, listDepth)
		builder.WriteString("~~")
	case "code":
		builder.WriteString("`")
		writeMarkdownChildren(builder, node, listDepth)
		builder.WriteString("`")
	case "pre":
		builder.WriteString("\n\n```\n")
		writeMarkdownChildren(builder, node, listDepth)
		builder.WriteString("\n```\n\n")
	case "blockquote":
		builder.WriteString("\n\n")
		var inner strings.Builder
		writeMarkdownChildren(&inner, node, listDepth)
		for _, line := range strings.Split(strings.TrimSpace(inner.String()), "\n") {
			builder.WriteString("> " + line + "\n")
		}
		builder.WriteString("\n")
	case "ul", "ol":
		builder.WriteString("\n")
		index := 1
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			if child.Type == html.ElementNode && strings.EqualFold(child.Data, "li") {
				builder.WriteString("\n" + strings.Repeat("  ", listDepth))
				if tag == "ol" {
					builder.WriteString(fmt.Sprintf("%d. ", index))
					index++
				} else {
					builder.WriteString("- ")
				}
				for itemChild := child.FirstChild; itemChild != nil; itemChild = itemChild.NextSibling {
					writeMarkdownNodes(builder, itemChild, listDepth+1)
				}
			}
		}
		builder.WriteString("\n\n")
	case "a":
		href := attribute(node, "href")
		builder.WriteString("[")
		writeMarkdownChildren(builder, node, listDepth)
		builder.WriteString("](" + href + ")")
	case "img":
		src := attribute(node, "src")
		alt := attribute(node, "alt")
		builder.WriteString(fmt.Sprintf("![%s](%s)", alt, src))
	case "hr":
		builder.WriteString("\n\n---\n\n")
	default:
		writeMarkdownChildren(builder, node, listDepth)
	}
}

func writeMarkdownChildren(builder *strings.Builder, node *html.Node, listDepth int) {
	for child := node.FirstChild; child != nil; child = child.NextSibling {
		writeMarkdownNodes(builder, child, listDepth)
	}
}

func attribute(node *html.Node, key string) string {
	for _, attr := range node.Attr {
		if strings.EqualFold(attr.Key, key) {
			return attr.Val
		}
	}
	return ""
}

func trimHTML(value string) string {
	node, err := html.Parse(bytes.NewBufferString(value))
	if err != nil {
		return strings.TrimSpace(value)
	}
	var builder strings.Builder
	writeMarkdownNodes(&builder, node, 0)
	return strings.TrimSpace(builder.String())
}
