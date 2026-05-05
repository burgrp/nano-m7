package font_awesome

import (
	"embed"

	webglue "github.com/burgrp/go-webglue/pkg"
)

//go:embed client/*
var resources embed.FS

func NewModule() *webglue.Module {

	return &webglue.Module{

		Name:      "font-awesome",
		Resources: &resources,
	}

}
