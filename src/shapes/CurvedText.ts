import { Util } from '../Util';
import { Factory } from '../Factory';
import { Shape, ShapeConfig } from '../Shape';
import { Konva } from '../Global';
import {
    getNumberValidator,
    getStringValidator,
    getNumberOrAutoValidator,
    getBooleanValidator,
} from '../Validators';
import { _registerNode } from '../Global';

import { GetSet } from '../types';

export interface CurvedTextConfig extends ShapeConfig {
    text?: string;
    fontFamily?: string;
    fontSize?: number;
    fontStyle?: string;
    fontVariant?: string;
    showCurvePath?: boolean;
    curveRadius?: number;
    curveDirection?: number;
}

// constants
var TEXT = 'text',
    PX_SPACE = 'px ',
    SPACE = ' '

function normalizeFontFamily(fontFamily: string) {
    return fontFamily
        .split(',')
        .map((family) => {
            family = family.trim();
            const hasSpace = family.indexOf(' ') >= 0;
            const hasQuotes = family.indexOf('"') >= 0 || family.indexOf("'") >= 0;
            if (hasSpace && !hasQuotes) {
                family = `"${family}"`;
            }
            return family;
        })
        .join(', ');
}

function _fillFunc(context) {
    context.fillText(this._partialText, this._partialTextX, this._partialTextY);
}
function _strokeFunc(context) {
    context.strokeText(this._partialText, this._partialTextX, this._partialTextY);
}

function checkDefaultFill(config) {
    config = config || {};

    // set default color to black
    if (
        !config.fillLinearGradientColorStops &&
        !config.fillRadialGradientColorStops &&
        !config.fillPatternImage
    ) {
        config.fill = config.fill || 'black';
    }
    return config;
}

/**
 * CurvedText constructor
 * @constructor
 * @memberof Konva
 * @augments Konva.Shape
 * @param {Object} config
 * @param {String} [config.fontFamily] default is Arial
 * @param {Number} [config.fontSize] in pixels.  Default is 12
 * @param {String} [config.fontStyle] can be 'normal', 'bold', 'italic' or even 'italic bold'.  Default is 'normal'
 * @param {String} config.text
* @@shapeParams
 * @@nodeParams
 * @example
 * var text = new Konva.CurvedText({
 *   x: 10,
 *   y: 15,
 *   text: 'Simple Text',
 *   fontSize: 30,
 *   fontFamily: 'Calibri',
 *   fill: 'green',
 *   curveRadius: 0,
 *   curveDirection: 1
 * });
 */
export class CurvedText extends Shape<CurvedTextConfig> {
    _computedText = null
    _editingMode = false
    constructor(config?: CurvedTextConfig) {
        super(checkDefaultFill(config));
        this.computeText()
    }
    getTextMetrics() {
        const context = Util.createCanvasElement().getContext('2d')
        context.font = this._getContextFont()
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        const text = this.text()
        const glyphs = []
        const xOffsets = [context.measureText(text.substring(0, 1)).width / 2]
        for (let i = 0; i < text.length; i++) {
            glyphs.push(text.substring(i, i + 1))
        }
        for (let i = 1; i < text.length; i++) {
            const pairTextWidth = context.measureText(text.substring(i - 1, i + 1)).width
            const prevCharWidth = context.measureText(glyphs[i - 1]).width
            const currentCharWidth = context.measureText(glyphs[i]).width
            xOffsets.push(xOffsets[i - 1] + pairTextWidth -
                prevCharWidth / 2 - currentCharWidth / 2)
        }
        return {
            text: text,
            xOffsets: xOffsets,
            width: context.measureText(text).width
        }
    }
    updateBounds(oldBounds, text) {
        const textBounds = { minX: text[0].x, minY: text[0].y, maxX: text[0].x, maxY: text[0].x }
        for (let i = 0; i < text.length; i++) {
            if (textBounds.minX > text[i].x) textBounds.minX = text[i].x
            if (textBounds.maxX < text[i].x) textBounds.maxX = text[i].x
            if (textBounds.minY > text[i].y) textBounds.minY = text[i].y
            if (textBounds.maxY < text[i].y) textBounds.maxY = text[i].y
        }
        const newBounds = { x: 0, y: 0, width: textBounds.maxX - textBounds.minX + this.fontSize(), height: textBounds.maxY - textBounds.minY + this.fontSize() }
        const x = (oldBounds.width * oldBounds.scaleX - newBounds.width * oldBounds.scaleX) / 2
        const y = this.getAttr('curveDirection') < 0 ? (oldBounds.height * oldBounds.scaleY - newBounds.height * oldBounds.scaleY) : 0
        this.width(newBounds.width)
        this.height(newBounds.height)
        this.x(oldBounds.x + (x * Math.cos(oldBounds.rotation * Math.PI / 180) + y * Math.sin(oldBounds.rotation * Math.PI / 180)))
        this.y(oldBounds.y + (x * Math.sin(oldBounds.rotation * Math.PI / 180) + y * Math.cos(oldBounds.rotation * Math.PI / 180)))
    }
    computeText() {
        const bounds = { x: this.x(), y: this.y(), width: this.width(), height: this.height(), rotation: this.rotation(), scaleX: this.scaleX(), scaleY: this.scaleY() }
        const curveRadius = this.getAttr('curveRadius') || 1000000
        const curveDirection = this.getAttr('curveDirection')
        const textMetrics = this.getTextMetrics()
        const text = []
        for (let i = 0; i < textMetrics.text.length; i++) {
            const circumference = Math.PI * (curveRadius * 2)
            const rotation = (-textMetrics.width / 2 + textMetrics.xOffsets[i]) * 360 / circumference
            const cx = 0
            const cy = curveDirection > 0 ? curveRadius : -curveRadius
            const x = curveRadius * Math.sin(rotation * Math.PI / 180)
            const y = cy - cy * Math.cos(rotation * Math.PI / 180)
            text.push({
                x: x,
                y: y,
                rotation: curveRadius === 0 ? 0 : curveDirection > 0 ? rotation * Math.PI / 180 : -rotation * Math.PI / 180,
                glyph: textMetrics.text[i]
            })
        }
        this.updateBounds(bounds, text)
        this.setAttr('_computedText', {
            curvePath: {
                cx: 0,
                cy: curveDirection > 0 ? curveRadius : -curveRadius,
                radius: curveRadius,
                color: 'rgb(31, 163, 249)'
            },
            textMetrics: textMetrics,
            curveText: text
        })
    }
    _sceneFunc(context) {
        const computedText = this.getAttr('_computedText')
        const curveDirection = this.getAttr('curveDirection')
        if (!computedText) {
            return
        }

        context.setAttr('fillStyle', this.getAttr('_editingMode') ? 'rgba(0,0,0,0.1)' : this.fill())
        context.setAttr('font', this._getContextFont())
        context.setAttr('textBaseline', 'middle')
        context.setAttr('textAlign', 'center')

        if (computedText) {
            for (let i = 0; i < computedText.curveText.length; i++) {
                context.save()
                context.translate(this.width() / 2 + computedText.curveText[i].x, curveDirection > 0 ? computedText.curveText[i].y + this.fontSize() / 2 : computedText.curveText[i].y + this.height() - this.fontSize() / 2)
                context.rotate(computedText.curveText[i].rotation)
                context.fillText(computedText.curveText[i].glyph, 0, 0);
                context.restore()
            }
            if (this.getAttr('curveRadius') !== 0 && this.getAttr('showCurvePath') && computedText.curvePath) {
                context.strokeStyle = computedText.curvePath.color
                context.save()
                context.beginPath()
                context.arc(this.width() / 2 + computedText.curvePath.cx, curveDirection > 0 ? computedText.curvePath.cy + this.fontSize() / 2 : computedText.curvePath.cy + this.height() - this.fontSize() / 2, computedText.curvePath.radius, 0, Math.PI * 2)
                context.stroke()
                context.beginPath()
                context.fillStyle = computedText.curvePath.color
                context.arc(this.width() / 2 + computedText.curvePath.cx, curveDirection > 0 ? computedText.curvePath.cy + this.fontSize() / 2 : computedText.curvePath.cy + this.height() - this.fontSize() / 2, 3, 0, Math.PI * 2)
                context.fill()
                context.restore()
            }
        }

    }
    _hitFunc(context) {
        var width = this.width(),
            height = this.height();

        context.beginPath();
        context.rect(0, 0, width, height);
        context.closePath();
        context.fillStrokeShape(this);
    }
    setText(text) {
        var str = Util._isString(text)
            ? text
            : text === null || text === undefined
                ? ''
                : text + '';
        this._setAttr(TEXT, str);
        this.computeText()
        return this;
    }

    _getContextFont() {
        return (
            this.fontStyle() +
            SPACE +
            this.fontVariant() +
            SPACE +
            (this.fontSize() + PX_SPACE) +
            // wrap font family into " so font families with spaces works ok
            normalizeFontFamily(this.fontFamily())
        );
    }
    fontFamily: GetSet<string, this>;
    fontSize: GetSet<number, this>;
    fontStyle: GetSet<string, this>;
    fontVariant: GetSet<string, this>;
    text: GetSet<string, this>;
    showCurvePath: GetSet<boolean, this>;
    curveRadius: GetSet<number, this>;
    curveDirection: GetSet<number, this>;
}

CurvedText.prototype._fillFunc = _fillFunc;
CurvedText.prototype._strokeFunc = _strokeFunc;
CurvedText.prototype.className = 'CurvedText';
CurvedText.prototype._attrsAffectingSize = [
    'text',
    'fontSize',
    'curveRadius',
    'curveDirection'
];
_registerNode(CurvedText);

/**
 * get/set width of text area, which includes padding.
 * @name Konva.CurvedText#width
 * @method
 * @param {Number} width
 * @returns {Number}
 * @example
 * // get width
 * var width = text.width();
 *
 * // set width
 * text.width(20);
 *
 * // set to auto
 * text.width('auto');
 * text.width() // will return calculated width, and not "auto"
 */
Factory.overWriteSetter(CurvedText, 'width', getNumberOrAutoValidator());

/**
 * get/set the height of the text area, which takes into account multi-line text, line heights, and padding.
 * @name Konva.CurvedText#height
 * @method
 * @param {Number} height
 * @returns {Number}
 * @example
 * // get height
 * var height = text.height();
 *
 * // set height
 * text.height(20);
 *
 * // set to auto
 * text.height('auto');
 * text.height() // will return calculated height, and not "auto"
 */

Factory.overWriteSetter(CurvedText, 'height', getNumberOrAutoValidator());

/**
 * get/set font family
 * @name Konva.CurvedText#fontFamily
 * @method
 * @param {String} fontFamily
 * @returns {String}
 * @example
 * // get font family
 * var fontFamily = text.fontFamily();
 *
 * // set font family
 * text.fontFamily('Arial');
 */
Factory.addGetterSetter(CurvedText, 'fontFamily', 'Arial');

/**
 * get/set font size in pixels
 * @name Konva.CurvedText#fontSize
 * @method
 * @param {Number} fontSize
 * @returns {Number}
 * @example
 * // get font size
 * var fontSize = text.fontSize();
 *
 * // set font size to 22px
 * text.fontSize(22);
 */
Factory.addGetterSetter(CurvedText, 'fontSize', 12, getNumberValidator());

/**
 * get/set font style.  Can be 'normal', 'italic', or 'bold' or even 'italic bold'.  'normal' is the default.
 * @name Konva.CurvedText#fontStyle
 * @method
 * @param {String} fontStyle
 * @returns {String}
 * @example
 * // get font style
 * var fontStyle = text.fontStyle();
 *
 * // set font style
 * text.fontStyle('bold');
 */

Factory.addGetterSetter(CurvedText, 'fontStyle', 'normal');

/**
 * get/set font variant.  Can be 'normal' or 'small-caps'.  'normal' is the default.
 * @name Konva.CurvedText#fontVariant
 * @method
 * @param {String} fontVariant
 * @returns {String}
 * @example
 * // get font variant
 * var fontVariant = text.fontVariant();
 *
 * // set font variant
 * text.fontVariant('small-caps');
 */

Factory.addGetterSetter(CurvedText, 'fontVariant', 'normal');



/**
 * get/set text
 * @name Konva.CurvedText#text
 * @method
 * @param {String} text
 * @returns {String}
 * @example
 * // get text
 * var text = text.text();
 *
 * // set text
 * text.text('Hello world!');
 */

Factory.addGetterSetter(CurvedText, 'text', '', getStringValidator());

